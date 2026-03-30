import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, Utensils, Sparkles, PackageCheck } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';
import { useOrderStore } from '../../stores/orderStore';
import { vibrate } from '../../lib/notifications';
import { formatTime } from '../../utils/formatters';

export default function WaiterNotifications() {
  const { user } = useAuthStore();
  const { notifications, subscribe, markRead } = useNotificationStore();
  const { updateOrderStatus } = useOrderStore();
  const [prevUnread, setPrevUnread] = useState(0);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribe('waiter');
    return unsub;
  }, [user]);

  // Vibrate + toast on new notifications
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    if (unread > prevUnread && prevUnread !== 0) {
      vibrate([200, 100, 200, 100, 200]);
      const newest = notifications.find((n) => !n.read);
      if (newest) toast(newest.message, { icon: '🔔', duration: 6000 });
    }
    setPrevUnread(unread);
  }, [notifications]);

  const handleMarkRead = async (id: string) => {
    await markRead(id);
  };

  const handleDeliver = async (n: typeof notifications[0]) => {
    if (!n.orderId) return;
    setDeliveringId(n.id);
    try {
      await updateOrderStatus(n.orderId, 'delivered');
      await markRead(n.id);
      toast.success(`Masa ${n.tableNumber} siparişi teslim edildi.`);
    } catch {
      toast.error('İşlem başarısız.');
    } finally {
      setDeliveringId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center mb-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-800">
          <Bell className="w-5 h-5 text-brand-600" />
          Bildirimler
        </h2>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bell className="w-14 h-14 mb-4 opacity-40" />
          <p className="text-lg font-semibold">Bildirim yok</p>
          <p className="text-sm mt-1">Yeni siparişler veya masa bildirimleri burada görünecek</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const isOrder   = n.type === 'order_ready_waiter';
            const isCleaning = n.type === 'table_needs_cleaning';
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-3 transition-opacity ${n.read ? 'opacity-60' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isOrder   ? 'bg-green-100' :
                  isCleaning ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  {isOrder    ? <Utensils className="w-5 h-5 text-green-600" /> :
                   isCleaning ? <Sparkles className="w-5 h-5 text-orange-500" /> :
                   <Bell className="w-5 h-5 text-gray-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? 'text-gray-500' : 'text-gray-900 font-semibold'}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatTime(n.sentAt)}</p>
                  {isOrder && (
                    <button
                      onClick={() => handleDeliver(n)}
                      disabled={deliveringId === n.id}
                      className="mt-2 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      {deliveringId === n.id ? 'Teslim Ediliyor…' : 'Teslim Et'}
                    </button>
                  )}
                </div>

                {!n.read && !isOrder && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
                    aria-label="Okundu işaretle"
                  >
                    <span className="text-xs">✓</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
