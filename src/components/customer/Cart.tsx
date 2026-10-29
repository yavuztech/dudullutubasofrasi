import { ShoppingCart, X, Minus, Plus, Trash2, MessageCircle, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { CartItem } from '../../types';

interface Props {
  items: CartItem[];
  onUpdate: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onToggleTakeaway?: (productId: string) => void;
  onClose: () => void;
  onCheckout?: () => void;
  onWhatsAppCheckout?: () => void;
  checkoutLoading?: boolean;
}

export default function Cart({
  items,
  onUpdate,
  onRemove,
  onToggleTakeaway,
  onClose,
  onCheckout,
  onWhatsAppCheckout,
  checkoutLoading,
}: Props) {
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col animate-slide-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">Sepetim</h2>
            <span className="badge bg-brand-100 text-brand-700">{items.length} ürün</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Sepetiniz boş</p>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-gray-900 truncate">{item.productName}</p>
                    {item.isTakeaway && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                        (Paket)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onToggleTakeaway && (
                    <button
                      onClick={() => onToggleTakeaway(item.productId)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${
                        item.isTakeaway
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                      }`}
                      title="Paket sipariş olarak işaretle"
                    >
                      <Package className="w-3 h-3" />
                      {item.isTakeaway ? 'Paket' : 'Masa'}
                    </button>
                  )}
                  <button
                    onClick={() => onUpdate(item.productId, -1)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => onUpdate(item.productId, 1)}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemove(item.productId)}
                    className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600 font-medium">Toplam</span>
              <span className="font-bold text-xl text-gray-900">{formatCurrency(total)}</span>
            </div>
            <div className="flex flex-col gap-2">
              {onWhatsAppCheckout && (
                <button
                  onClick={onWhatsAppCheckout}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp ile Sipariş Ver
                </button>
              )}
              {onCheckout && (
                <button
                  onClick={onCheckout}
                  disabled={checkoutLoading}
                  className="btn-primary w-full text-center"
                >
                  {checkoutLoading ? 'Sipariş Veriliyor…' : 'Siparişi Onayla'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
