import { CheckCircle, Clock, Flame, Package, User, Utensils } from 'lucide-react';
import type { Order } from '../../types';
import { formatCurrency, formatTime, minutesAgo, orderStatusLabel } from '../../utils/formatters';

interface Props {
  order: Order;
  onMarkReady: (order: Order) => void;
  onMarkPreparing: (order: Order) => void;
  loading?: boolean;
  tableDisplayName?: string; // Masa adı (section bilgisi içerebilir)
}

const statusColors: Record<string, string> = {
  pending:   'border-l-orange-400 bg-orange-50',
  preparing: 'border-l-blue-400 bg-blue-50',
  ready:     'border-l-green-400 bg-green-50',
};

export default function KitchenOrderCard({ order, onMarkReady, onMarkPreparing, loading, tableDisplayName }: Props) {
  const age = minutesAgo(order.createdAt);

  return (
    <div className={`rounded-2xl border-l-4 shadow-sm p-4 ${statusColors[order.status] ?? 'border-l-gray-300 bg-white'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {order.type === 'table' ? (
              <Utensils className="w-4 h-4 text-gray-600" />
            ) : (
              <Package className="w-4 h-4 text-brand-600" />
            )}
            <span className="font-bold text-gray-900">
              {order.type === 'table' ? (tableDisplayName || `Masa ${order.tableNumber}`) : 'Gel Al'}
            </span>
            {order.type === 'takeaway' && order.customerPhone && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" />
                {order.customerName || order.customerPhone.slice(-4).padStart(order.customerPhone.length, '*')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatTime(order.createdAt)}
            {age > 0 && (
              <span className={`ml-1 font-medium ${age > 15 ? 'text-red-600' : age > 8 ? 'text-orange-500' : 'text-gray-400'}`}>
                · {age} dk
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
          <span className={`badge text-xs mt-0.5 ${
            order.status === 'pending'   ? 'bg-orange-100 text-orange-700' :
            order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {orderStatusLabel(order.status)}
          </span>
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-1 mb-4">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              <span className="font-bold text-gray-900 mr-1.5">{item.quantity}×</span>
              {item.productName}
            </span>
            <span className="text-gray-500">{formatCurrency(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 mb-3">
          📝 {order.notes === 'MASA_KIRLI' ? '⚠️ Masa temizlenmemiş olabilir!' : order.notes}
        </div>
      )}

      {/* Actions */}
      {order.status === 'pending' && (
        <button
          onClick={() => onMarkPreparing(order)}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Flame className="w-4 h-4" />
          Hazırlamaya Başla
        </button>
      )}

      {order.status === 'preparing' && (
        <button
          onClick={() => onMarkReady(order)}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 active:scale-95"
        >
          <CheckCircle className="w-4 h-4" />
          Hazır!
        </button>
      )}

      {order.status === 'ready' && (
        <div className="w-full bg-green-100 text-green-800 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" />
          Garson Bekleniyor…
        </div>
      )}
    </div>
  );
}
