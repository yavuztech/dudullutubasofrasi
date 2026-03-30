import { CheckCircle, Clock, ChefHat, PackageCheck, X } from 'lucide-react';
import type { Order } from '../../types';
import { formatTime } from '../../utils/formatters';

interface Props {
  order: Order;
  onClose?: () => void;
  inline?: boolean;
}

const tableSteps = ['pending', 'preparing', 'ready', 'delivered'] as const;
const takeawaySteps = ['pending', 'preparing', 'delivered'] as const;

const stepLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  pending:   { label: 'Sipariş Alındı',      icon: <Clock className="w-5 h-5" /> },
  preparing: { label: 'Hazırlanıyor',       icon: <ChefHat className="w-5 h-5" /> },
  ready:     { label: 'Hazır',              icon: <CheckCircle className="w-5 h-5" /> },
  delivered: { label: 'Teslim Edildi',     icon: <PackageCheck className="w-5 h-5" /> },
};

const takeawayStepLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  pending:   { label: 'Sipariş Alındı',      icon: <Clock className="w-5 h-5" /> },
  preparing: { label: 'Hazırlanıyor',       icon: <ChefHat className="w-5 h-5" /> },
  delivered: { label: 'Hazır — Alabilirsiniz!', icon: <PackageCheck className="w-5 h-5" /> },
};

export default function OrderTracker({ order, onClose, inline }: Props) {
  const isTakeaway = order.type === 'takeaway';
  const steps = isTakeaway ? takeawaySteps : tableSteps;
  const labels = isTakeaway ? takeawayStepLabels : stepLabels;

  // Map 'ready' to 'delivered' index for takeaway (ready auto-becomes delivered)
  const effectiveStatus = isTakeaway && order.status === 'ready' ? 'delivered' : order.status;
  const currentIdx = (steps as readonly string[]).indexOf(effectiveStatus);

  const content = (
    <div className={inline ? 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4' : 'relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 animate-slide-in shadow-2xl'}>
      {onClose && !inline && (
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      )}

      <h2 className={`font-bold text-gray-900 mb-0.5 ${inline ? 'text-sm' : 'text-lg'}`}>Sipariş Durumu</h2>
      <p className="text-xs text-gray-500 mb-4">
        {order.type === 'table' ? `Masa ${order.tableNumber}` : 'Gel Al Siparişi'}
        {' · '}{formatTime(order.createdAt)}
      </p>

      {/* Status steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          const { label, icon } = labels[step];
          return (
            <div key={step} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                done
                  ? active
                    ? 'bg-brand-600 text-white animate-pulse'
                    : 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <span className="scale-75">{icon}</span>
              </div>
              <div>
                <p className={`font-medium text-sm ${done ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
                {active && <p className="text-xs text-brand-600 font-medium">Şu an bu aşamada</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item list — shown in inline mode */}
      {inline && order.items && order.items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
              <span className="text-gray-500">{(item.unitPrice * item.quantity).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
            </div>
          ))}
        </div>
      )}

      {order.status === 'delivered' && isTakeaway && (
        <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
          <p className="text-green-800 font-semibold text-center text-sm">🎉 Siparişiniz Hazır! Gelebilirsiniz.</p>
        </div>
      )}

      {order.status === 'delivered' && !isTakeaway && (
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-blue-800 font-semibold text-center text-sm">✅ Siparişiniz teslim edildi. Afiyet olsun!</p>
        </div>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {content}
    </div>
  );
}
