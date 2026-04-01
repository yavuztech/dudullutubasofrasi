import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChefHat, Package } from 'lucide-react';
import { useOrderStore } from '../../stores/orderStore';
import { useNotificationStore } from '../../stores/notificationStore';
import KitchenOrderCard from '../../components/kitchen/KitchenOrderCard';
import type { Order } from '../../types';

export default function KitchenOrders() {
  const { orders, subscribe, updateOrderStatus } = useOrderStore();
  const { createNotification } = useNotificationStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribe(['pending', 'preparing', 'ready']);
    return unsub;
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

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCount = [...tableOrders, ...takeawayOrders].filter(
    (o) => ['pending', 'preparing', 'ready'].includes(o.status)
  ).length;

  return (
    <div className="flex flex-col h-full">
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
    </div>
  );
}
