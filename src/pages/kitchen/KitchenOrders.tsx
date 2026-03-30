import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChefHat, Package, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import {
  collection, query, where, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useOrderStore } from '../../stores/orderStore';
import { useTableStore } from '../../stores/tableStore';
import { useNotificationStore } from '../../stores/notificationStore';
import KitchenOrderCard from '../../components/kitchen/KitchenOrderCard';
import { formatCurrency, formatTime } from '../../utils/formatters';
import type { Order } from '../../types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

type Tab = 'orders' | 'cashier';

export default function KitchenOrders() {
  const { orders, subscribe, updateOrderStatus } = useOrderStore();
  const { tables, updateTableStatus, newSession } = useTableStore();
  const { createNotification } = useNotificationStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('orders');

  // Cashier tab data
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [paidTodayOrders, setPaidTodayOrders] = useState<Order[]>([]);
  const [cashierLoading, setCashierLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribe(['pending', 'preparing', 'ready']);
    return unsub;
  }, []);

  // Subscribe to delivered + today's paid orders for cashier tab
  useEffect(() => {
    setCashierLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const q1 = query(
      collection(db, 'orders'),
      where('status', 'in', ['delivered']),
      where('type', '==', 'table'),
    );
    const q2 = query(
      collection(db, 'orders'),
      where('status', '==', 'paid'),
      where('type', '==', 'table'),
      where('updatedAt', '>=', Timestamp.fromDate(startOfDay)),
    );

    const fromSnap = (id: string, data: Record<string, unknown>): Order => ({
      ...(data as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
      id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });

    const u1 = onSnapshot(q1, (snap) => {
      setDeliveredOrders(
        snap.docs.map((d) => fromSnap(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      );
      setCashierLoading(false);
    }, () => setCashierLoading(false));

    const u2 = onSnapshot(q2, (snap) => {
      setPaidTodayOrders(
        snap.docs.map((d) => fromSnap(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      );
    });

    return () => { u1(); u2(); };
  }, []);

  // ── Active orders handlers ─────────────────────────────────────────────────

  const tableOrders   = orders.filter((o) => o.type === 'table');
  const takeawayOrders = orders.filter((o) => o.type === 'takeaway');

  const handleMarkPreparing = async (order: Order) => {
    setLoadingId(order.id);
    try {
      await updateOrderStatus(order.id, 'preparing');
      toast.success(`${order.type === 'table' ? `Masa ${order.tableNumber}` : 'Gel Al'} hazırlanıyor.`);
    } finally { setLoadingId(null); }
  };

  const handleMarkReady = async (order: Order) => {
    setLoadingId(order.id);
    try {
      await updateOrderStatus(order.id, 'ready');
      if (order.type === 'table') {
        await createNotification({
          type: 'order_ready_waiter', orderId: order.id,
          tableId: order.tableId, tableNumber: order.tableNumber,
          message: `Masa ${order.tableNumber} siparişi hazır! 🔔`, targetRole: 'waiter',
        });
        toast.success(`Garson bilgilendirildi — Masa ${order.tableNumber}`);
      }
      if (order.type === 'takeaway') {
        await createNotification({
          type: 'order_ready_customer', orderId: order.id,
          message: `Gel Al siparişi hazır — ${order.customerName || order.customerPhone}`,
          targetRole: 'customer',
        });
        // Takeaway: no waiter needed — mark as delivered immediately
        await updateOrderStatus(order.id, 'delivered');
        toast.success('Gel Al siparişi hazır, müşteri bilgilendirildi!');
      }
    } finally { setLoadingId(null); }
  };

  // ── Cashier handlers ──────────────────────────────────────────────────────

  // Group delivered orders by sessionId (each customer visit = separate session)
  const deliveredBySession = deliveredOrders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = o.sessionId ?? o.tableId ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const handlePayTable = async (tableId: string, tableNumber: number | undefined, tableOrds: Order[]) => {
    const activeForTable = orders.filter(
      (o) => o.tableId === tableId && ['pending', 'preparing', 'ready'].includes(o.status)
    );
    if (activeForTable.length > 0) {
      toast.error(
        `Masa ${tableNumber}: ${activeForTable.length} sipariş henüz teslim edilmedi. Önce tüm siparişleri teslim edin veya iptal edin.`,
        { duration: 5000 }
      );
      return;
    }
    setLoadingId(tableId);
    try {
      await Promise.all(tableOrds.map((o) => updateOrderStatus(o.id, 'paid')));
      // Start a new session so future orders won't mix with this visit
      await newSession(tableId);
      await updateTableStatus(tableId, 'needs_cleaning', undefined);
      toast.success(`Masa ${tableNumber} ödeme alındı, temizlik bekleniyor.`);
    } catch {
      toast.error('İşlem başarısız.');
    } finally {
      setLoadingId(null);
    }
  };

  // Group today's paid by tableNumber (for lookup)
  const paidByTable = paidTodayOrders.reduce<Record<string, Order[]>>((acc, o) => {
    const key = String(o.tableNumber ?? 'unknown');
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCount = [...tableOrders, ...takeawayOrders].filter(
    (o) => ['pending', 'preparing', 'ready'].includes(o.status)
  ).length;
  const pendingPaymentCount = Object.keys(deliveredBySession).length;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white px-4 gap-1">
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'orders' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Siparişler
          {activeCount > 0 && (
            <span className="w-5 h-5 bg-brand-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{activeCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('cashier')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'cashier' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Kasa
          {pendingPaymentCount > 0 && (
            <span className="w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{pendingPaymentCount}</span>
          )}
        </button>
      </div>

      {/* ── Siparişler tab ── */}
      {tab === 'orders' && (
        <div className="p-4 sm:p-6 overflow-auto">
          {activeCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <ChefHat className="w-16 h-16 mb-4 opacity-40" />
              <p className="text-xl font-semibold">Bekleyen sipariş yok</p>
              <p className="text-sm mt-1">Yeni siparişler burada görünecek</p>
            </div>
          ) : (
            <>
              {takeawayOrders.filter(o => ['pending','preparing','ready'].includes(o.status)).length > 0 && (
                <div className="mb-6">
                  <h2 className="flex items-center gap-2 font-bold text-gray-800 mb-3">
                    <Package className="w-5 h-5 text-brand-600" /> Gel Al Siparişleri
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {takeawayOrders.filter(o => ['pending','preparing','ready'].includes(o.status)).map((order) => (
                      <KitchenOrderCard key={order.id} order={order} onMarkPreparing={handleMarkPreparing} onMarkReady={handleMarkReady} loading={loadingId === order.id} />
                    ))}
                  </div>
                </div>
              )}
              {tableOrders.filter(o => ['pending','preparing','ready'].includes(o.status)).length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-gray-800 mb-3">
                    <ChefHat className="w-5 h-5 text-brand-600" /> Masa Siparişleri
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tableOrders.filter(o => ['pending','preparing','ready'].includes(o.status)).map((order) => (
                      <KitchenOrderCard key={order.id} order={order} onMarkPreparing={handleMarkPreparing} onMarkReady={handleMarkReady} loading={loadingId === order.id} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Kasa tab ── */}
      {tab === 'cashier' && (
        <div className="p-4 sm:p-6 overflow-auto">
          {/* Ödeme bekleyen masalar */}
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Ödeme Bekleyen Masalar
          </h2>

          {cashierLoading ? (
            <p className="text-gray-400 text-sm py-6 text-center">Yükleniyor…</p>
          ) : Object.keys(deliveredBySession).length === 0 ? (
            <div className="card text-center py-10 text-gray-400 mb-6">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Ödeme bekleyen masa yok</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-8">
              {Object.entries(deliveredBySession).map(([sessionKey, tableOrds]) => {
                const tableId   = tableOrds[0]?.tableId ?? sessionKey;
                const tableNumber = tableOrds[0]?.tableNumber;
                // Check if this session is for the CURRENT table session
                // (a new customer might have the same tableId but different sessionId)
                const currentSession = tables.find((t) => t.id === tableId)?.sessionId;
                const sessionId = tableOrds[0]?.sessionId;
                const isCurrentSession = !sessionId || !currentSession || sessionId === currentSession;
                const total = tableOrds.reduce((s, o) => s + o.totalAmount, 0);
                return (
                  <div key={sessionKey} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900 text-lg">Masa {tableNumber}</p>
                        <p className="text-xs text-gray-500">{tableOrds.length} sipariş · {tableOrds.reduce((s,o)=>s+o.items.length,0)} kalem</p>
                        {!isCurrentSession && (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium mt-0.5">
                            ⚠️ Bu masa artık yeni müşteriye geçti — önceki müşteri hesabı
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-brand-600 text-xl">{formatCurrency(total)}</p>
                    </div>

                    {/* Order breakdown */}
                    <div className="border-t border-gray-100 pt-3 mb-3 flex flex-col gap-2">
                      {tableOrds.map((o) => (
                        <div key={o.id}>
                          <p className="text-xs text-gray-400 mb-1">{formatTime(o.createdAt)} — {formatCurrency(o.totalAmount)}</p>
                          {o.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-700">{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
                              <span className="text-gray-600">{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const hasActive = orders.some(
                        (o) => o.tableId === tableId && ['pending', 'preparing', 'ready'].includes(o.status)
                      );
                      return (
                        <>
                          {hasActive && (
                            <p className="text-xs text-amber-600 font-medium mb-2 flex items-center gap-1">
                              ⚠️ Bu masada henüz teslim edilmemiş sipariş var. Ödeme alınamaz.
                            </p>
                          )}
                          <button
                            onClick={() => handlePayTable(tableId, tableNumber, tableOrds)}
                            disabled={loadingId === tableId || hasActive}
                            className={`w-full flex items-center justify-center gap-2 ${
                              hasActive ? 'btn-disabled' : 'btn-success'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            {loadingId === tableId ? 'İşleniyor…' : `Ödeme Alındı — ${formatCurrency(total)}`}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bugün ödenenler — referans için */}
          {paidTodayOrders.length > 0 && (
            <>
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Bugün Ödenenler
                <span className="text-xs text-gray-400 font-normal">(müşteri sonradan gelirse bakabilirsiniz)</span>
              </h2>
              <div className="flex flex-col gap-2">
                {Object.entries(paidByTable).map(([tableNum, tableOrds]) => {
                  const total = tableOrds.reduce((s, o) => s + o.totalAmount, 0);
                  return (
                    <div key={tableNum} className="card flex items-center justify-between py-3">
                      <div>
                        <p className="font-semibold text-gray-800">Masa {tableNum}</p>
                        <p className="text-xs text-gray-400">
                          {formatTime(tableOrds[tableOrds.length-1].updatedAt)} · {tableOrds.length} sipariş
                        </p>
                      </div>
                      <p className="font-bold text-green-600">{formatCurrency(total)}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
