import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  requestNotificationPermission,
  hasAskedPermission,
} from '../../lib/notifications';

interface Props {
  onGranted?: () => void;
  /** Dışarıdan kontrol — true olduğunda tüm koşulları atlayıp göster */
  forceShow?: boolean;
  onClose?: () => void;
}

export default function NotificationPermissionModal({ onGranted, forceShow, onClose }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (forceShow !== undefined) return; // dışarıdan yönetiliyor
    if (
      'Notification' in window &&
      Notification.permission === 'default' &&
      !hasAskedPermission()
    ) {
      setShow(true);
    }
  }, []);

  const visible = forceShow !== undefined ? forceShow : show;
  if (!visible) return null;

  const handleAllow = async () => {
    const perm = await requestNotificationPermission();
    if (forceShow !== undefined) { onClose?.(); } else { setShow(false); }
    if (perm === 'granted') onGranted?.();
  };

  const handleDeny = () => {
    if (forceShow !== undefined) { onClose?.(); } else {
      localStorage.setItem('notif_permission_asked', 'true');
      setShow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-slide-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Bildirim İzni</h3>
            <p className="text-sm text-gray-500">Siparişiniz hazır olduğunda haberdar olun</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Siparişinizin durumu hakkında anlık bildirim alabilmeniz için
          bildirim iznine ihtiyacımız var. Bu izin yalnızca bir kez sorulacaktır.
        </p>

        <div className="flex gap-3">
          <button onClick={handleDeny} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <BellOff className="w-4 h-4" />
            Hayır
          </button>
          <button onClick={handleAllow} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" />
            İzin Ver
          </button>
        </div>
      </div>
    </div>
  );
}
