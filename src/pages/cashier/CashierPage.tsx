import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTableStore } from '../../stores/tableStore';
import { useProductStore } from '../../stores/productStore';
import { useDebtStore } from '../../stores/debtStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Banknote, CreditCard, LayoutGrid, Package, X, CheckCircle,
  Plus, Minus, Trash2, BadgePercent, ShoppingCart, ArrowLeftRight, Printer,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { getTableDisplayName, getMergedTableDisplayName } from '../../utils/tableUtils';
import toast from 'react-hot-toast';
import TableTransferModal from '../../components/shared/TableTransferModal';
import ReceiptModal from '../../components/cashier/ReceiptModal';
import type { Order, OrderItem, Table } from '../../types';

type Tab = 'tables' | 'takeaway' | 'debts';

const STATUS_LABEL: Record<string, string> = {
  pending:   'Bekliyor',
  preparing: 'Hazırlanıyor',
  ready:     'Hazır',
  delivered: 'Teslim Edildi',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready:     'bg-green-100 text-green-700',
  delivered: 'bg-purple-100 text-purple-700',
};

function toDate(v: unknown): Date {
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
  if (v instanceof Date) return v;
  return new Date();
}

interface Bill { key: string; table: Table; orders: Order[]; sessionId: string | null; total: number; }

interface Props {
  mode?: 'general' | 'ladies';
}

export default function CashierPage({ mode }: Props = {}) {
  const location = useLocation();
  const { tables, subscribe, newSession } = useTableStore();
  const { products, categories, subscribe: subProducts, subscribeCategories } = useProductStore();
  const { settings, subscribe: subSettings } = useSettingsStore();
  const { user } = useAuthStore();
  const cashierLadiesOnly = !!user?.roles.includes('cashier_ladies') && !user.roles.includes('cashier') && !user.roles.includes('admin');
  const isLadiesView = mode === 'ladies' || location.pathname.endsWith('/ladies') || cashierLadiesOnly;
  const { debts, loading: debtsLoading, subscribe: subscribeDebts, createTableDebt, recordPayment } = useDebtStore();

  const [tab, setTab] = useState<Tab>('tables');
  const [activeTableOrders, setActiveTableOrders] = useState<Order[]>([]);
  const [takeawayOrders, setTakeawayOrders] = useState<Order[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [transferBill, setTransferBill] = useState<Bill | null>(null);
  const [cancelBillConfirm, setCancelBillConfirm] = useState<Bill | null>(null);
  const [confirmCloseBill, setConfirmCloseBill] = useState(false);
  const [creditBill, setCreditBill] = useState<Bill | null>(null);
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [debtSearch, setDebtSearch] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [closeAfterPrint, setCloseAfterPrint] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null); // takeaway fiş
  const [confirmCloseTakeaway, setConfirmCloseTakeaway] = useState<{ order: Order; finalAmount?: number } | null>(null);
  const [closeTakeawayAfterPrint, setCloseTakeawayAfterPrint] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<'all' | 'normal' | 'family' | 'ladies'>('all');

  // Discount
  const [applyDiscount, setApplyDiscount] = useState(false);

  // New takeaway order
  const [newTakeaway, setNewTakeaway] = useState(false);
  const [ntName, setNtName] = useState('');
  const [ntPhone, setNtPhone] = useState('');
  const [ntCart, setNtCart] = useState<OrderItem[]>([]);
  const [ntLoading, setNtLoading] = useState(false);
  const [twDiscountOrders, setTwDiscountOrders] = useState<Set<string>>(new Set());

  // Edit order items inline
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editShowAdd, setEditShowAdd] = useState(false);

  // Add product panel
  const [addMode, setAddMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [addCart, setAddCart] = useState<OrderItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subProducts();
    const u3 = subscribeCategories();
    const u4 = subSettings();
    const u5 = subscribeDebts(isLadiesView ? 'ladies' : undefined);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [isLadiesView, subscribe, subProducts, subscribeCategories, subSettings, subscribeDebts]);

  useEffect(() => {
    const filters = [
      where('type', '==', 'table'),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
    ];
    if (isLadiesView) filters.push(where('tableSection', '==', 'ladies'));
    return onSnapshot(
      query(collection(db, 'orders'), ...filters),
      (snap) => setActiveTableOrders(snap.docs.map((d) => ({ ...(d.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>), id: d.id, createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt) } as Order)))
    );
  }, [isLadiesView]);

  useEffect(() => {
    if (isLadiesView) return;
    const legacyOrders = activeTableOrders.filter((order) => !order.tableSection && order.tableId);
    if (legacyOrders.length === 0) return;

    const migrations = legacyOrders.flatMap((order) => {
      const table = tables.find((candidate) => candidate.id === order.tableId);
      if (!table) return [];
      return [updateDoc(doc(db, 'orders', order.id), {
        tableSection: table.section ?? 'normal',
        tableLabel: getTableDisplayName(table),
        updatedAt: serverTimestamp(),
      })];
    });
    if (migrations.length > 0) {
      Promise.all(migrations).catch((error) => {
        console.error('Mevcut siparişlerin masa bölümü bilgisi güncellenemedi:', error);
      });
    }
  }, [activeTableOrders, tables, isLadiesView]);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'orders'), where('type', '==', 'takeaway'), where('status', 'in', ['pending', 'preparing', 'ready', 'delivered'])),
      (snap) => setTakeawayOrders(snap.docs.map((d) => ({ ...(d.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>), id: d.id, createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt) } as Order)).filter((o) => !o.isTestOrder).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()))
    );
  }, []);

  const bills = useMemo((): Bill[] => {
    const map = new Map<string, Order[]>();
    for (const o of activeTableOrders) {
      if (!o.tableId || o.isTestOrder) continue;
      const key = `${o.tableId}__${o.sessionId ?? ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    const result: Bill[] = [];
    for (const [key, orders] of map.entries()) {
      const table = tables.find((t) => t.id === orders[0].tableId);
      if (!table) continue;
      result.push({ key, table, orders: orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), sessionId: orders[0].sessionId ?? null, total: orders.reduce((s, o) => s + o.totalAmount, 0) });
    }
    return result.sort((a, b) => a.table.number !== b.table.number ? a.table.number - b.table.number : (a.orders[0]?.createdAt.getTime() ?? 0) - (b.orders[0]?.createdAt.getTime() ?? 0));
  }, [activeTableOrders, tables]);

  // Sync selectedBill when orders update
  useEffect(() => {
    if (!selectedBill) return;
    const updated = bills.find((b) => b.key === selectedBill.key);
    if (!updated) setSelectedBill(null);
    else setSelectedBill(updated);
  }, [bills]);

  // When opening bill clear discount state
  const openBill = (bill: Bill) => {
    setSelectedBill(bill);
    setApplyDiscount(false);
    setEditingOrder(null);
    setAddMode(false);
    setAddCart([]);
  };

  // ── Edit order ────────────────────────────────────────────────────────────
  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setEditItems(order.items.map((i) => ({ ...i })));
    setAddMode(false);
    setEditShowAdd(false);
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    const valid = editItems.filter((i) => i.quantity > 0);
    setEditLoading(true);
    try {
      const newTotal = valid.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      if (valid.length === 0) {
        await updateDoc(doc(db, 'orders', editingOrder.id), { status: 'cancelled', items: [], totalAmount: 0, updatedAt: serverTimestamp() });
        toast.success('Sipariş iptal edildi.');
      } else {
        await updateDoc(doc(db, 'orders', editingOrder.id), { items: valid, totalAmount: newTotal, updatedAt: serverTimestamp() });
        toast.success('Sipariş güncellendi.');
      }
      setEditingOrder(null);
      setEditShowAdd(false);
    } catch { toast.error('Güncellenemedi.'); }
    finally { setEditLoading(false); }
  };

  // ── Add products ──────────────────────────────────────────────────────────
  const availableProducts = useMemo(() => products.filter((p) => p.available), [products]);

  const addToEdit = (p: typeof products[0]) => setEditItems((prev) => {
    const ex = prev.find((i) => i.productId === p.id);
    if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...prev, { productId: p.id, productName: p.name, unitPrice: p.price, quantity: 1 }];
  });
  const removeFromEdit = (pid: string) => setEditItems((prev) => prev.map((i) => i.productId === pid ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  const grouped = useMemo(() => {
    const m: Record<string, typeof products> = {};
    for (const p of availableProducts) { if (!m[p.category]) m[p.category] = []; m[p.category].push(p); }
    return m;
  }, [availableProducts]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories]);

  const cartQty = (pid: string) => addCart.find((i) => i.productId === pid)?.quantity ?? 0;
  const addToCart = (p: typeof products[0]) => setAddCart((prev) => {
    const ex = prev.find((i) => i.productId === p.id);
    if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...prev, { productId: p.id, productName: p.name, unitPrice: p.price, quantity: 1 }];
  });
  const removeFromCart = (pid: string) => setAddCart((prev) => prev.map((i) => i.productId === pid ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  const cartCount = addCart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = addCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const sendAddCart = async () => {
    if (!selectedBill || addCart.length === 0) return;
    setAddLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        type: 'table',
        tableId: selectedBill.table.id,
        tableNumber: selectedBill.table.number,
        tableLabel: tableLabel(selectedBill.table),
        tableSection: selectedBill.table.section ?? 'normal',
        sessionId: selectedBill.sessionId ?? selectedBill.table.sessionId,
        items: addCart,
        totalAmount: cartTotal,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success(`${cartCount} ürün eklendi.`);
      setAddCart([]);
      setAddMode(false);
    } catch { toast.error('Sipariş gönderilemedi.'); }
    finally { setAddLoading(false); }
  };

  // ── New takeaway order ─────────────────────────────────────────────────────
  const ntQty = (pid: string) => ntCart.find((i) => i.productId === pid)?.quantity ?? 0;
  const addToNt = (p: typeof products[0]) => setNtCart((prev) => {
    const ex = prev.find((i) => i.productId === p.id);
    if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    return [...prev, { productId: p.id, productName: p.name, unitPrice: p.price, quantity: 1 }];
  });
  const removeFromNt = (pid: string) => setNtCart((prev) => prev.map((i) => i.productId === pid ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  const ntCount = ntCart.reduce((s, i) => s + i.quantity, 0);
  const ntTotal = ntCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const submitNtOrder = async () => {
    if (ntCart.length === 0) return;
    setNtLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        type: 'takeaway',
        tableId: null,
        tableNumber: null,
        sessionId: null,
        customerName: ntName.trim() || 'Kasa Siparişi',
        customerPhone: ntPhone.trim() || '',
        items: ntCart,
        totalAmount: ntTotal,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Paket sipariş oluşturuldu.');
      setNtCart([]);
      setNtName('');
      setNtPhone('');
      setNewTakeaway(false);
    } catch { toast.error('Sipariş oluşturulamadı.'); }
    finally { setNtLoading(false); }
  };

  // ── Close bill ────────────────────────────────────────────────────────────
  const closeTableBill = async () => {
    if (!selectedBill || selectedBill.orders.length === 0) return;
    setClosingId(selectedBill.key);
    try {
      await Promise.all(selectedBill.orders.map((o) => updateDoc(doc(db, 'orders', o.id), {
        status: 'paid',
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
      })));
      await newSession(selectedBill.table.id);
      await updateDoc(doc(db, 'tables', selectedBill.table.id), {
        status: 'available',
        mergedTableIds: [],
        mergedTableNumbers: [],
        updatedAt: serverTimestamp(),
      });
      // Birleşik masaları da boşa al
      if (selectedBill.table.mergedTableIds?.length) {
        await Promise.all(selectedBill.table.mergedTableIds.map((id) =>
          updateDoc(doc(db, 'tables', id), {
            status: 'available',
            mergedIntoId: null,
            updatedAt: serverTimestamp(),
          }),
        ));
      }
      const label = tableLabel(selectedBill.table);
      toast.success(`${label} hesabı kapatıldı!`);
      setSelectedBill(null);
    } catch { toast.error('Hesap kapatılamadı.'); }
    finally { setClosingId(null); }
  };

  const createCreditAccount = async () => {
    if (!creditBill || creditBill.orders.length === 0) return;
    const customerName = creditCustomerName.trim();
    if (!customerName) {
      toast.error('Borç kaydı için müşteri adını girin.');
      return;
    }

    setClosingId(creditBill.key);
    try {
      await createTableDebt({
        customerName,
        tableId: creditBill.table.id,
        tableLabel: tableLabel(creditBill.table),
        tableSection: creditBill.table.section ?? 'normal',
        orderIds: creditBill.orders.map((order) => order.id),
        items: creditBill.orders.flatMap((order) => order.items),
        subtotal: creditBill.total,
        discountAmount,
        totalAmount: finalTotal,
        mergedTableIds: creditBill.table.mergedTableIds ?? [],
      });
      toast.success(`${formatCurrency(finalTotal)} tutarındaki borç ${customerName} adına kaydedildi.`);
      setCreditBill(null);
      setCreditCustomerName('');
      setSelectedBill(null);
    } catch (error) {
      console.error('Veresiye hesabı kaydedilemedi:', error);
      const errorCode = (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && typeof error.code === 'string'
      ) ? error.code : '';
      toast.error(errorCode === 'permission-denied'
        ? 'Açık hesap izni reddedildi. Güncel firestore.rules dosyasını Firebase’e deploy edin ve personel hesabında Kasa rolü olduğunu kontrol edin.'
        : error instanceof Error ? error.message : 'Açık hesap kaydedilemedi.');
    } finally {
      setClosingId(null);
    }
  };

  const submitDebtPayment = async (debtId: string, remainingAmount: number) => {
    const amount = Number(paymentAmounts[debtId] ?? remainingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Tahsilat tutarı sıfırdan büyük olmalıdır.');
      return;
    }
    if (amount > remainingAmount) {
      toast.error('Tahsilat kalan borç tutarından fazla olamaz.');
      return;
    }

    setPayingDebtId(debtId);
    try {
      await recordPayment(debtId, amount);
      setPaymentAmounts((previous) => {
        const next = { ...previous };
        delete next[debtId];
        return next;
      });
      toast.success('Tahsilat kaydedildi.');
    } catch (error) {
      console.error('Veresiye tahsilatı kaydedilemedi:', error);
      toast.error(error instanceof Error ? error.message : 'Tahsilat kaydedilemedi.');
    } finally {
      setPayingDebtId(null);
    }
  };

  const cancelTableBill = async () => {
    if (!cancelBillConfirm) return;
    const bill = cancelBillConfirm;
    setCancelBillConfirm(null);
    setSelectedBill(null);
    setClosingId(bill.key);
    
    try {
      // Tüm siparişleri iptal et
      await Promise.all(bill.orders.map((o) => 
        updateDoc(doc(db, 'orders', o.id), { 
          status: 'cancelled', 
          updatedAt: serverTimestamp() 
        })
      ));
      
      // Yeni session başlat
      await newSession(bill.table.id);
      
      // Masayı boşa al
      await updateDoc(doc(db, 'tables', bill.table.id), {
        status: 'available',
        mergedTableIds: [],
        mergedTableNumbers: [],
        updatedAt: serverTimestamp(),
      });
      
      // Birleşik masaları da sıfırla
      if (bill.table.mergedTableIds?.length) {
        await Promise.all(bill.table.mergedTableIds.map((id) =>
          updateDoc(doc(db, 'tables', id), {
            status: 'available',
            mergedIntoId: null,
            updatedAt: serverTimestamp(),
          }),
        ));
      }
      
      const label = tableLabel(bill.table);
      toast.success(`${label} hesabı iptal edildi.`);
    } catch { 
      toast.error('Hesap iptal edilemedi.'); 
    } finally { 
      setClosingId(null); 
    }
  };

  const toggleTwDiscount = (id: string) => setTwDiscountOrders((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const closeTakeawayBill = async (orderId: string, finalAmount?: number) => {
    setClosingId(orderId);
    try {
      const update: Record<string, unknown> = {
        status: 'paid',
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
      };
      if (finalAmount !== undefined) update.totalAmount = finalAmount;
      await updateDoc(doc(db, 'orders', orderId), update);
      toast.success('Ödeme alındı!');
      setTwDiscountOrders((prev) => { const n = new Set(prev); n.delete(orderId); return n; });
    } catch { toast.error('İşlem başarısız.'); }
    finally { setClosingId(null); }
  };

  // ── Discount calc ─────────────────────────────────────────────────────────
  const rawTotal = selectedBill?.total ?? 0;
  const discountRate = settings.staffDiscountRate ?? 0;
  const discountAmount = applyDiscount && settings.staffDiscount ? Math.round(rawTotal * discountRate / 100) : 0;
  const finalTotal = rawTotal - discountAmount;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const tableLabel = (table: Table) => {
    if (table.mergedTableNumbers?.length) {
      return getMergedTableDisplayName([table.number, ...table.mergedTableNumbers], table.section);
    }
    return getTableDisplayName(table);
  };

  // Section bazlı gruplama
  const normalBills = bills.filter((b) => !b.table.section || b.table.section === 'normal');
  const familyBills = bills.filter((b) => b.table.section === 'family');
  const ladiesBills = bills.filter((b) => b.table.section === 'ladies');
  const filteredDebts = debts.filter((debt) => {
    const search = debtSearch.trim().toLocaleLowerCase('tr-TR');
    return !search
      || debt.customerName.toLocaleLowerCase('tr-TR').includes(search)
      || debt.tableLabel.toLocaleLowerCase('tr-TR').includes(search);
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('tables')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'tables' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <LayoutGrid className="w-4 h-4" />Masalar
          {(isLadiesView ? ladiesBills.length : bills.length) > 0 && <span className={`text-xs rounded-full px-1.5 ${tab === 'tables' ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'}`}>{isLadiesView ? ladiesBills.length : bills.length}</span>}
        </button>
        <button onClick={() => setTab('takeaway')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'takeaway' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Package className="w-4 h-4" />Gel Al
          {takeawayOrders.length > 0 && <span className={`text-xs rounded-full px-1.5 ${tab === 'takeaway' ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'}`}>{takeawayOrders.length}</span>}
        </button>
        <button onClick={() => setTab('debts')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'debts' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Banknote className="w-4 h-4" />Açık Hesap
          {debts.filter((debt) => debt.status === 'open').length > 0 && (
            <span className={`text-xs rounded-full px-1.5 ${tab === 'debts' ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'}`}>
              {debts.filter((debt) => debt.status === 'open').length}
            </span>
          )}
        </button>
      </div>

      {/* Masalar */}
      {tab === 'tables' && ((isLadiesView ? ladiesBills : bills).length === 0 ? (
        <div className="text-center py-16 text-gray-400"><LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">Aktif hesap yok</p></div>
      ) : (
        <div className="flex flex-col gap-6">
          {!isLadiesView && (
            <div className="flex gap-2 border-b border-gray-100 pb-3 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSectionFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                  sectionFilter === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tüm Masalar ({bills.length})
              </button>
              {normalBills.length > 0 && (
                <button
                  onClick={() => setSectionFilter('normal')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                    sectionFilter === 'normal'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🍽️ Masalar ({normalBills.length})
                </button>
              )}
              {familyBills.length > 0 && (
                <button
                  onClick={() => setSectionFilter('family')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                    sectionFilter === 'family'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  👨‍👩‍👧‍👦 Aile Bölümü ({familyBills.length})
                </button>
              )}
              {ladiesBills.length > 0 && (
                <button
                  onClick={() => setSectionFilter('ladies')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                    sectionFilter === 'ladies'
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Hanım Kafeteryası ({ladiesBills.length})
                </button>
              )}
            </div>
          )}

          {/* Normal Masalar */}
          {normalBills.length > 0 && (sectionFilter === 'all' || sectionFilter === 'normal') && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                🍽️ MASALAR ({normalBills.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {normalBills.map((bill) => {
                  const same = bills.filter((b) => b.table.id === bill.table.id);
                  const sessionSuffix = same.length > 1 ? ` #${same.indexOf(bill) + 1}` : '';
                  return (
                    <button key={bill.key} onClick={() => openBill(bill)} className="card flex flex-col gap-2 text-left hover:border-brand-300 hover:shadow-md transition-all active:scale-[0.98]">
                      <div className="flex items-center justify-between"><span className="font-bold text-gray-900 text-base">{tableLabel(bill.table)}{sessionSuffix}</span><Banknote className="w-4 h-4 text-green-600" /></div>
                      <p className="text-xs text-gray-400">{bill.orders.length} sipariş</p>
                      <p className="font-bold text-brand-600">{formatCurrency(bill.total)}</p>
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full self-start">Hesap açık</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Aile Bölümü */}
          {familyBills.length > 0 && (sectionFilter === 'all' || sectionFilter === 'family') && (
            <div>
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                👨‍👩‍👧‍👦 AİLE BÖLÜMÜ ({familyBills.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {familyBills.map((bill) => {
                  const same = bills.filter((b) => b.table.id === bill.table.id);
                  const sessionSuffix = same.length > 1 ? ` #${same.indexOf(bill) + 1}` : '';
                  return (
                    <button key={bill.key} onClick={() => openBill(bill)} className="card flex flex-col gap-2 text-left hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98] border-blue-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900 text-base">{tableLabel(bill.table)}{sessionSuffix}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">⚡</span>
                      </div>
                      <p className="text-xs text-gray-400">{bill.orders.length} sipariş</p>
                      <p className="font-bold text-brand-600">{formatCurrency(bill.total)}</p>
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full self-start">Hesap açık</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hanım Kafeteryası */}
          {ladiesBills.length > 0 && (sectionFilter === 'all' || sectionFilter === 'ladies') && (
            <div>
              <h3 className="text-sm font-bold text-pink-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                HANIM KAFETERYASI ({ladiesBills.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ladiesBills.map((bill) => (
                  <button key={bill.key} onClick={() => openBill(bill)} className="card flex flex-col gap-2 text-left hover:border-pink-300 hover:shadow-md transition-all active:scale-[0.98] border-pink-100">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900 text-base">{tableLabel(bill.table)}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">H</span>
                    </div>
                    <p className="text-xs text-gray-400">{bill.orders.length} sipariş</p>
                    <p className="font-bold text-brand-600">{formatCurrency(bill.total)}</p>
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full self-start">Hesap açık</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Gel Al */}
      {tab === 'takeaway' && (
        <div className="flex flex-col gap-4">
          {/* Yeni paket sipariş butonu / formu */}
          {!newTakeaway ? (
            <button
              onClick={() => { setNewTakeaway(true); setNtCart([]); setNtName(''); setNtPhone(''); }}
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-brand-300 hover:border-brand-500 text-brand-600 hover:text-brand-700 rounded-xl text-sm font-semibold transition-colors bg-brand-50/50"
            >
              <Plus className="w-4 h-4" /> Yeni Paket Sipariş
            </button>
          ) : (
            <div className="border-2 border-brand-200 rounded-xl p-4 flex flex-col gap-3 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-bold text-brand-700 flex items-center gap-1.5"><Package className="w-4 h-4" /> Yeni Paket Sipariş</p>
                <button onClick={() => { setNewTakeaway(false); setNtCart([]); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="Müşteri adı (opsiyonel)" className="input py-2 text-sm col-span-2 sm:col-span-1" />
                <input value={ntPhone} onChange={(e) => setNtPhone(e.target.value)} placeholder="Telefon (opsiyonel)" className="input py-2 text-sm col-span-2 sm:col-span-1" type="tel" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${activeCategory === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {(grouped[activeCategory] ?? []).map((p) => {
                  const qty = ntQty(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <p className="flex-1 text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-brand-600 font-semibold flex-shrink-0">{formatCurrency(p.price)}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {qty > 0 ? (
                          <>
                            <button onClick={() => removeFromNt(p.id)} className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-50"><Minus className="w-3 h-3" /></button>
                            <span className="w-4 text-center text-sm font-bold">{qty}</span>
                          </>
                        ) : <span className="w-10" />}
                        <button onClick={() => addToNt(p)} className="w-6 h-6 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {ntCount > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <ShoppingCart className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span className="text-sm text-gray-600 flex-1">{ntCount} ürün • {formatCurrency(ntTotal)}</span>
                  <button onClick={submitNtOrder} disabled={ntLoading} className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-60">
                    {ntLoading ? 'Gönderiliyor…' : 'Siparişi Gönder'}
                  </button>
                </div>
              )}

            </div>
          )}

          {takeawayOrders.length === 0 ? (
            <div className="text-center py-10 text-gray-400"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">Bekleyen Gel Al siparişi yok</p></div>
          ) : (
            <div className="flex flex-col gap-3">
          {takeawayOrders.map((order) => {
            const isTwEditing = editingOrder?.id === order.id;
            const hasTwDiscount = twDiscountOrders.has(order.id) && !!settings.staffDiscount;
            const twDiscountAmount = hasTwDiscount ? Math.round(order.totalAmount * discountRate / 100) : 0;
            const twFinalAmount = order.totalAmount - twDiscountAmount;
            return (
            <div key={order.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold text-gray-900">{order.customerName || 'İsimsiz Müşteri'}</p><p className="text-xs text-gray-500">{order.customerPhone}</p></div>
                <div className="flex items-center gap-2">
                  {!isTwEditing && (
                    <button onClick={() => openEdit(order)} className="text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg font-semibold transition-colors">
                      Düzenle
                    </button>
                  )}
                  <span className={`badge text-xs flex-shrink-0 ${STATUS_COLOR[order.status] ?? ''}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
                </div>
              </div>

              {isTwEditing ? (
                <div className="flex flex-col gap-2">
                  {editItems.map((item, idx) => (
                    <div key={item.productId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <p className="flex-1 text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500 flex-shrink-0">{formatCurrency(item.unitPrice)}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-50">
                          {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-gray-600" />}
                        </button>
                        <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                        <button onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                          <Plus className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {editItems.length === 0 && <p className="text-xs text-center text-orange-600 py-1">Tüm ürünler kaldırıldı — sipariş iptal edilecek.</p>}

                  {/* Ürün Ekle butonu */}
                  <button
                    onClick={() => setEditShowAdd(true)}
                    className="w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-300 hover:border-brand-400 text-gray-500 hover:text-brand-600 rounded-lg py-2 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ürün Ekle
                  </button>

                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { setEditingOrder(null); setEditShowAdd(false); }} className="btn-secondary flex-1 py-1.5 text-xs">Vazgeç</button>
                    <button onClick={saveEdit} disabled={editLoading} className={`flex-1 py-1.5 text-xs flex items-center justify-center gap-1 disabled:opacity-60 ${editItems.length === 0 ? 'bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold' : 'btn-primary'}`}>
                      {editLoading ? 'Kaydediliyor…' : editItems.length === 0 ? 'İptal Et' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-600 space-y-0.5 bg-gray-50 rounded-xl p-3">
                  {order.items.map((item, i) => (<div key={i} className="flex justify-between"><span>{item.productName} <span className="text-gray-400">×{item.quantity}</span></span><span className="font-medium">{formatCurrency(item.unitPrice * item.quantity)}</span></div>))}
                </div>
              )}

              {!isTwEditing && (
                <div className="flex flex-col gap-2 pt-1">
                  {settings.staffDiscount && (
                    <button
                      onClick={() => toggleTwDiscount(order.id)}
                      className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-xl w-full"
                    >
                      <div className="flex items-center gap-2">
                        <BadgePercent className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-orange-700">Personel İndirimi (%{discountRate})</span>
                      </div>
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasTwDiscount ? 'bg-orange-500' : 'bg-gray-200'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${hasTwDiscount ? 'translate-x-4' : 'translate-x-1'}`} />
                      </div>
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      {hasTwDiscount && twDiscountAmount > 0 && (
                        <p className="text-xs text-gray-400 line-through">{formatCurrency(order.totalAmount)}</p>
                      )}
                      <span className="font-bold text-gray-900 text-base">{formatCurrency(twFinalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReceiptOrder(order)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600"
                        title="Fiş Yazdır"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmCloseTakeaway({ order, finalAmount: hasTwDiscount ? twFinalAmount : undefined })} disabled={closingId === order.id} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-50">
                        <CreditCard className="w-4 h-4" />{closingId === order.id ? 'İşleniyor…' : 'Hesabı Kapat'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
            </div>
          )}
        </div>
      )}

      {tab === 'debts' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Açık Hesaplar</h2>
            <p className="text-sm text-gray-500">Açık borçları görüntüleyin ve tam ya da kısmi tahsilat kaydedin.</p>
          </div>
          <input
            type="search"
            value={debtSearch}
            onChange={(event) => setDebtSearch(event.target.value)}
            placeholder="Müşteri veya masa ara"
            className="input"
          />
          {filteredDebts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">
                {debtsLoading
                  ? 'Açık hesaplar yükleniyor…'
                  : debts.length ? 'Aramayla eşleşen açık hesap yok' : 'Açık hesap yok'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredDebts.map((debt) => {
                const remainingAmount = Math.max(0, debt.totalAmount - debt.paidAmount);
                const open = debt.status === 'open' && remainingAmount > 0;
                return (
                  <div key={debt.id} className="card flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{debt.customerName}</h3>
                        <p className="text-sm text-gray-500">{debt.tableLabel} · {debt.createdAt.toLocaleString('tr-TR')}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${open ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {open ? 'Açık' : 'Ödendi'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span>Toplam: <strong>{formatCurrency(debt.totalAmount)}</strong></span>
                      <span>Tahsil edilen: <strong>{formatCurrency(debt.paidAmount)}</strong></span>
                      <span className={open ? 'text-red-600' : 'text-green-700'}>
                        Kalan: <strong>{formatCurrency(remainingAmount)}</strong>
                      </span>
                    </div>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 font-medium">Fiş detayını göster</summary>
                      <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 font-mono text-xs">
                        {debt.items.map((item, index) => (
                          <div key={`${item.productId}-${index}`} className="flex justify-between gap-3 py-1">
                            <span className="min-w-0">{item.productName} ×{item.quantity}</span>
                            <span className="shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                          </div>
                        ))}
                        {debt.discountAmount ? (
                          <>
                            <div className="mt-2 border-t border-dashed border-gray-300 pt-2 flex justify-between text-gray-600">
                              <span>ARA TOPLAM</span>
                              <span>{formatCurrency(debt.subtotal ?? debt.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))}</span>
                            </div>
                            <div className="flex justify-between pt-1 text-gray-600">
                              <span>İNDİRİM</span>
                              <span>-{formatCurrency(debt.discountAmount)}</span>
                            </div>
                          </>
                        ) : null}
                        <div className="mt-2 border-t border-dashed border-gray-300 pt-2 flex justify-between font-bold">
                          <span>HESAP TOPLAMI</span>
                          <span>{formatCurrency(debt.totalAmount)}</span>
                        </div>
                        {debt.paidAmount > 0 && (
                          <div className="flex justify-between pt-1 text-gray-500">
                            <span>KALAN</span>
                            <span>{formatCurrency(remainingAmount)}</span>
                          </div>
                        )}
                      </div>
                    </details>
                    {open && (
                      <form
                        className="flex flex-col sm:flex-row gap-2 border-t border-gray-100 pt-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitDebtPayment(debt.id, remainingAmount);
                        }}
                      >
                        <label className="sr-only" htmlFor={`payment-${debt.id}`}>Tahsilat tutarı</label>
                        <input
                          id={`payment-${debt.id}`}
                          type="number"
                          min="0.01"
                          max={remainingAmount}
                          step="0.01"
                          required
                          value={paymentAmounts[debt.id] ?? remainingAmount.toFixed(2)}
                          onChange={(event) => setPaymentAmounts((previous) => ({
                            ...previous,
                            [debt.id]: event.target.value,
                          }))}
                          className="input flex-1"
                          aria-label={`${debt.customerName} tahsilat tutarı`}
                        />
                        <button
                          type="submit"
                          disabled={payingDebtId !== null}
                          className="btn-primary py-2 px-4 disabled:opacity-50"
                        >
                          {payingDebtId === debt.id ? 'Kaydediliyor…' : 'Tahsilat Kaydet'}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Masa hesap modal ── */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setSelectedBill(null); setEditingOrder(null); setAddMode(false); setAddCart([]); }} />
          <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-in flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{tableLabel(selectedBill.table)}</h3>
                <p className="text-xs text-gray-500">{selectedBill.orders.length} sipariş • Hesap detayı</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCancelBillConfirm(selectedBill)}
                  title="Hesabı İptal Et"
                  className="p-2 rounded-xl hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTransferBill(selectedBill)}
                  title="Aktar / Birleştir"
                  className="p-2 rounded-xl hover:bg-blue-50 text-blue-600"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <button onClick={() => { setSelectedBill(null); setEditingOrder(null); setAddMode(false); setAddCart([]); }} className="p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Siparişler */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedBill.orders.map((order) => {
                const isEditing = editingOrder?.id === order.id;
                return (
                  <div key={order.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`badge text-xs ${STATUS_COLOR[order.status] ?? ''}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{order.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                        {!isEditing && !addMode && (
                          <button onClick={() => openEdit(order)} className="text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg font-semibold transition-colors">
                            Düzenle
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        {editItems.map((item, idx) => (
                          <div key={item.productId} className="flex items-center gap-2 bg-white rounded-lg p-2">
                            <p className="flex-1 text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                            <p className="text-xs text-gray-500 flex-shrink-0">{formatCurrency(item.unitPrice)}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-50">
                                {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-gray-600" />}
                              </button>
                              <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                              <button onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                                <Plus className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {editItems.length === 0 && <p className="text-xs text-center text-orange-600 py-1">Tüm ürünler kaldırıldı — sipariş iptal edilecek.</p>}
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => setEditingOrder(null)} className="btn-secondary flex-1 py-1.5 text-xs">Vazgeç</button>
                          <button onClick={saveEdit} disabled={editLoading} className={`flex-1 py-1.5 text-xs flex items-center justify-center gap-1 disabled:opacity-60 ${editItems.length === 0 ? 'bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold' : 'btn-primary'}`}>
                            {editLoading ? 'Kaydediliyor…' : editItems.length === 0 ? 'İptal Et' : 'Kaydet'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-0.5">
                          <span className="text-gray-700">{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
                          <span className="font-medium text-gray-900">{formatCurrency(item.unitPrice * item.quantity)}</span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}

              {/* Ürün Ekle butonu (düzenleme yoksa) */}
              {!editingOrder && (
                <button 
                  onClick={() => { setAddMode(true); setAddCart([]); }} 
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                    addMode 
                      ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm' 
                      : 'border-2 border-dashed border-gray-200 hover:border-brand-400 text-gray-500 hover:text-brand-600'
                  }`}
                >
                  {addMode ? (
                    <><ShoppingCart className="w-4 h-4" /> Ürün Ekleniyor ({cartCount})</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Ürün Ekle</>
                  )}
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-3">
              {/* Personel indirimi */}
              {settings.staffDiscount && (
                <button
                  onClick={() => setApplyDiscount((v) => !v)}
                  className="flex items-center justify-between cursor-pointer px-3 py-2.5 bg-orange-50 rounded-xl w-full"
                >
                  <div className="flex items-center gap-2">
                    <BadgePercent className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-semibold text-orange-700">Personel İndirimi (%{discountRate})</span>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${applyDiscount ? 'bg-orange-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${applyDiscount ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </button>
              )}

              {/* Toplam */}
              <div>
                {applyDiscount && discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-400 line-through">{formatCurrency(rawTotal)}</span>
                    <span className="text-orange-600 font-semibold">-%{discountRate} = -{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 font-medium">Toplam</span>
                  <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(finalTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="flex-shrink-0 py-3.5 px-4 rounded-2xl border-2 border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 font-semibold"
                  >
                    <Printer className="w-5 h-5" />
                    Fiş
                  </button>
                  <button
                    onClick={() => {
                      setCreditCustomerName('');
                      setCreditBill(selectedBill);
                    }}
                    disabled={!!closingId || !!editingOrder || addMode}
                    className="flex-shrink-0 py-3.5 px-3 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 flex items-center gap-1.5 text-orange-800 font-semibold disabled:opacity-50"
                  >
                    <Banknote className="w-5 h-5" />
                    Açık Hesap
                  </button>
                  <button
                    onClick={() => setConfirmCloseBill(true)}
                    disabled={!!closingId || !!editingOrder || addMode}
                    className="btn-primary flex-1 py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {closingId ? 'İşleniyor…' : 'Hesabı Kapat'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {transferBill && (
        <TableTransferModal
          sourceTable={transferBill.table}
          onClose={() => setTransferBill(null)}
        />
      )}

      {showReceipt && selectedBill && (
        <ReceiptModal
          tableNumber={selectedBill.table.number}
          tableLabel={tableLabel(selectedBill.table)}
          orders={selectedBill.orders}
          discountRate={discountRate}
          discountApplied={applyDiscount && !!settings.staffDiscount}
          onClose={() => {
            setShowReceipt(false);
            setCloseAfterPrint(false);
          }}
          onPrinted={closeAfterPrint ? () => {
            setCloseAfterPrint(false);
            setShowReceipt(false);
            void closeTableBill();
          } : undefined}
        />
      )}

      {/* Ürün Ekleme Popup - Edit Mode */}
      {editShowAdd && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditShowAdd(false)} />
          <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col m-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-gray-900">Ürün Ekle</h3>
              <button onClick={() => setEditShowAdd(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Kategori seçimi */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-4 pb-3 flex-shrink-0 border-b border-gray-100">
              {categories.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveCategory(cat.id)} 
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeCategory === cat.id 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            
            {/* Ürün listesi (scrollable) */}
            <div className="overflow-y-auto flex-1 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(grouped[activeCategory] ?? []).map((p) => {
                  const qty = editItems.find((i) => i.productId === p.id)?.quantity ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-sm text-brand-600 font-semibold">{formatCurrency(p.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {qty > 0 ? (
                          <>
                            <button 
                              onClick={() => removeFromEdit(p.id)} 
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="w-6 text-center font-bold">{qty}</span>
                          </>
                        ) : <span className="w-16" />}
                        <button 
                          onClick={() => addToEdit(p)} 
                          className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 transition-colors shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-600" />
                <span className="font-medium text-gray-900">
                  {editItems.length > 0 ? `${editItems.length} ürün seçildi` : 'Ürün seçin'}
                </span>
              </div>
              <button 
                onClick={() => setEditShowAdd(false)} 
                className="btn-primary px-6 py-2"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün Ekleme Popup - Add Mode */}
      {addMode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAddMode(false); setAddCart([]); }} />
          <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col m-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-gray-900">Ürün Ekle</h3>
              <button onClick={() => { setAddMode(false); setAddCart([]); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Kategori seçimi */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-4 pb-3 flex-shrink-0 border-b border-gray-100">
              {categories.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveCategory(cat.id)} 
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeCategory === cat.id 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            
            {/* Ürün listesi (scrollable) */}
            <div className="overflow-y-auto flex-1 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(grouped[activeCategory] ?? []).map((p) => {
                  const qty = cartQty(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-sm text-brand-600 font-semibold">{formatCurrency(p.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {qty > 0 ? (
                          <>
                            <button 
                              onClick={() => removeFromCart(p.id)} 
                              className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="w-6 text-center font-bold">{qty}</span>
                          </>
                        ) : <span className="w-16" />}
                        <button 
                          onClick={() => addToCart(p)} 
                          className="w-8 h-8 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700 transition-colors shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-600" />
                <span className="font-medium text-gray-900">
                  {cartCount > 0 ? `${cartCount} ürün • ${formatCurrency(cartTotal)}` : 'Ürün seçin'}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setAddMode(false); setAddCart([]); }} 
                  className="btn-secondary px-4 py-2"
                >
                  İptal
                </button>
                <button 
                  onClick={() => { sendAddCart(); setAddMode(false); }} 
                  disabled={addLoading || cartCount === 0} 
                  className="btn-primary px-6 py-2 disabled:opacity-50"
                >
                  {addLoading ? 'Gönderiliyor…' : 'Mutfağa Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hesap İptal Onay Modalı */}
      {cancelBillConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCancelBillConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Hesabı İptal Et</h3>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>{tableLabel(cancelBillConfirm.table)}</strong> hesabı iptal edilecek.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Tüm siparişler iptal edilecek ve masa boşa alınacak. Ödeme alınmayacak. Bu işlem geri alınamaz.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelBillConfirm(null)}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={cancelTableBill}
                className="btn-danger flex-1"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCloseBill && selectedBill && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !closingId && setConfirmCloseBill(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg">Emin misiniz? Hesap kapatılsın mı?</h3>
            <p className="text-sm text-gray-600 mt-2">
              <strong>{tableLabel(selectedBill.table)}</strong> hesabındaki {formatCurrency(finalTotal)} tutarındaki hesap kapatılacak.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                onClick={() => setConfirmCloseBill(false)}
                disabled={!!closingId}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  setConfirmCloseBill(false);
                  setCloseAfterPrint(true);
                  setShowReceipt(true);
                }}
                disabled={!!closingId}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                Fiş Yazdır ve Kapat
              </button>
              <button
                onClick={() => {
                  setConfirmCloseBill(false);
                  void closeTableBill();
                }}
                disabled={!!closingId}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {closingId ? 'İşleniyor…' : 'Kapat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {creditBill && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !closingId && setCreditBill(null)}
          />
          <form
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void createCreditAccount();
            }}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-orange-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Açık Hesap Oluştur</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {tableLabel(creditBill.table)} hesabı kapatılacak ve borç olarak kaydedilecek.
                </p>
              </div>
            </div>
            <label htmlFor="credit-customer-name" className="block text-sm font-medium text-gray-700 mb-1">
              Müşteri adı *
            </label>
            <input
              id="credit-customer-name"
              type="text"
              required
              autoFocus
              maxLength={100}
              value={creditCustomerName}
              onChange={(event) => setCreditCustomerName(event.target.value)}
              className="input w-full"
              placeholder="Borç kimin adına kaydedilsin?"
            />
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 font-mono text-xs">
              <p className="text-center font-bold text-gray-700 mb-2">HESAP FİŞİ</p>
              <div className="flex flex-col divide-y divide-dashed divide-gray-200">
                {creditBill.orders.flatMap((order) => order.items).map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0">{item.productName} ×{item.quantity}</span>
                    <span className="shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 mt-1 text-gray-600">
                    <span>ARA TOPLAM</span>
                    <span>{formatCurrency(creditBill.total)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-gray-600">
                    <span>İNDİRİM</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="mt-2 border-t border-dashed border-gray-400 pt-2 flex items-center justify-between font-bold text-sm">
                <span>TOPLAM BORÇ</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Masa boşa alınır. Borç Açık Hesaplar bölümünde görünür; sonradan kısmi veya tam tahsilat kaydedebilirsiniz.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setCreditBill(null)}
                disabled={!!closingId}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={!!closingId}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {closingId === creditBill.key ? 'Kaydediliyor…' : 'Borç Kaydet ve Kapat'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmCloseTakeaway && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !closingId && setConfirmCloseTakeaway(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg">Emin misiniz? Hesap kapatılsın mı?</h3>
            <p className="text-sm text-gray-600 mt-2">
              <strong>{confirmCloseTakeaway.order.customerName || 'Gel Al Siparişi'}</strong> hesabındaki {formatCurrency(confirmCloseTakeaway.finalAmount ?? confirmCloseTakeaway.order.totalAmount)} tutarındaki paket sipariş kapatılacak.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                onClick={() => setConfirmCloseTakeaway(null)}
                disabled={!!closingId}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  const target = confirmCloseTakeaway;
                  setConfirmCloseTakeaway(null);
                  setCloseTakeawayAfterPrint(true);
                  setReceiptOrder(target.order);
                }}
                disabled={!!closingId}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                Fiş Yazdır ve Kapat
              </button>
              <button
                onClick={async () => {
                  const target = confirmCloseTakeaway;
                  setConfirmCloseTakeaway(null);
                  await closeTakeawayBill(target.order.id, target.finalAmount);
                }}
                disabled={!!closingId}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {closingId ? 'İşleniyor…' : 'Kapat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal
          customerName={receiptOrder.customerName}
          customerPhone={receiptOrder.customerPhone}
          orders={[receiptOrder]}
          discountRate={discountRate}
          discountApplied={twDiscountOrders.has(receiptOrder.id) && !!settings.staffDiscount}
          onClose={() => {
            setReceiptOrder(null);
            setCloseTakeawayAfterPrint(false);
          }}
          onPrinted={closeTakeawayAfterPrint ? async () => {
            const order = receiptOrder;
            setCloseTakeawayAfterPrint(false);
            setReceiptOrder(null);
            const hasTwDiscount = twDiscountOrders.has(order.id) && !!settings.staffDiscount;
            const twFinalAmount = hasTwDiscount ? Math.round(order.totalAmount * (1 - discountRate / 100)) : undefined;
            await closeTakeawayBill(order.id, twFinalAmount);
          } : undefined}
        />
      )}
    </div>
  );
}
