import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs,
  onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTableStore } from '../../stores/tableStore';
import { Banknote, CreditCard, LayoutGrid, Package, X, ChevronRight, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import type { Order, Table } from '../../types';

type Tab = 'tables' | 'takeaway';

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

export default function CashierPage() {
  const { tables, subscribe, newSession } = useTableStore();
  const [tab, setTab] = useState<Tab>('tables');

  // Table bill modal
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [loadingTableOrders, setLoadingTableOrders] = useState(false);

  // Takeaway orders
  const [takeawayOrders, setTakeawayOrders] = useState<Order[]>([]);

  const [closingId, setClosingId] = useState<string | null>(null);

  // Subscribe to table store
  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  // Subscribe to active takeaway orders
  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('type', '==', 'takeaway'),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
    );
    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs
        .map((d) => ({
          ...(d.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toDate(d.data().createdAt),
          updatedAt: toDate(d.data().updatedAt),
        } as Order))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setTakeawayOrders(orders);
    });
    return unsub;
  }, []);

  const openTable = async (table: Table) => {
    setSelectedTable(table);
    setLoadingTableOrders(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'orders'),
        where('tableId', '==', table.id),
        where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
      ));
      const orders = snap.docs.map((d) => ({
        ...(d.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
        id: d.id,
        createdAt: toDate(d.data().createdAt),
        updatedAt: toDate(d.data().updatedAt),
      } as Order));
      setTableOrders(orders);
    } finally {
      setLoadingTableOrders(false);
    }
  };

  const closeTableBill = async () => {
    if (!selectedTable || tableOrders.length === 0) return;
    setClosingId(selectedTable.id);
    try {
      await Promise.all(
        tableOrders.map((o) =>
          updateDoc(doc(db, 'orders', o.id), { status: 'paid', updatedAt: serverTimestamp() })
        )
      );
      // Yeni oturum başlat — böylece eski siparişler yeni müşteriye karışmaz
      await newSession(selectedTable.id);
      await updateDoc(doc(db, 'tables', selectedTable.id), {
        status: 'needs_cleaning',
        updatedAt: serverTimestamp(),
      });
      toast.success(`Masa ${selectedTable.number} hesabı kapatıldı!`);
      setSelectedTable(null);
      setTableOrders([]);
    } catch {
      toast.error('Hesap kapatılamadı. Tekrar deneyin.');
    } finally {
      setClosingId(null);
    }
  };

  const closeTakeawayBill = async (orderId: string) => {
    setClosingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'paid', updatedAt: serverTimestamp() });
      toast.success('Ödeme alındı!');
    } catch {
      toast.error('İşlem başarısız. Tekrar deneyin.');
    } finally {
      setClosingId(null);
    }
  };

  const billableTables = tables.filter((t) =>
    t.status === 'occupied' || t.status === 'needs_cleaning' || t.status === 'being_cleaned'
  );
  const tableTotal = tableOrders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="p-4 sm:p-6">

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('tables')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'tables'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Masalar
          {billableTables.length > 0 && (
            <span className={`text-xs rounded-full px-1.5 ${tab === 'tables' ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'}`}>
              {billableTables.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('takeaway')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === 'takeaway'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Gel Al
          {takeawayOrders.length > 0 && (
            <span className={`text-xs rounded-full px-1.5 ${tab === 'takeaway' ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'}`}>
              {takeawayOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Masalar tab ── */}
      {tab === 'tables' && (
        billableTables.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Aktif masa yok</p>
            <p className="text-sm mt-1">Şu an ödeme bekleyen masa bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {billableTables.map((table) => (
              <button
                key={table.id}
                onClick={() => openTable(table)}
                className="card flex flex-col gap-2 text-left hover:border-brand-300 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-base">Masa {table.number}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400">{table.capacity} kişilik</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Banknote className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Hesap açık</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── Gel Al tab ── */}
      {tab === 'takeaway' && (
        takeawayOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Bekleyen Gel Al siparişi yok</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {takeawayOrders.map((order) => (
              <div key={order.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900">{order.customerName || 'İsimsiz Müşteri'}</p>
                    <p className="text-xs text-gray-500">{order.customerPhone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${STATUS_COLOR[order.status] ?? ''}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5 bg-gray-50 rounded-xl p-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
                      <span className="font-medium">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-gray-900 text-base">{formatCurrency(order.totalAmount)}</span>
                  <button
                    onClick={() => closeTakeawayBill(order.id)}
                    disabled={closingId === order.id}
                    className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    {closingId === order.id ? 'İşleniyor…' : 'Ödendi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Masa hesap modal ── */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedTable(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-in flex flex-col max-h-[85vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Masa {selectedTable.number}</h3>
                <p className="text-xs text-gray-500">Hesap detayı</p>
              </div>
              <button onClick={() => setSelectedTable(null)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Order list */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTableOrders ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : tableOrders.length === 0 ? (
                <p className="text-center text-gray-400 py-10">Bu masaya ait aktif sipariş bulunamadı.</p>
              ) : (
                <div className="space-y-3">
                  {tableOrders.map((order) => (
                    <div key={order.id} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-2">
                        {order.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-0.5">
                          <span className="text-gray-700">
                            {item.productName} <span className="text-gray-400">×{item.quantity}</span>
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 font-medium">Toplam</span>
                <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(tableTotal)}</span>
              </div>
              <button
                onClick={closeTableBill}
                disabled={closingId === selectedTable.id || tableOrders.length === 0 || loadingTableOrders}
                className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                {closingId === selectedTable.id ? 'İşleniyor…' : 'Hesabı Kapat'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
