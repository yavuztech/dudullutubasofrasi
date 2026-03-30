import { formatCurrency } from '../../utils/formatters';
import type { Product } from '../../types';

interface Props {
  product: Product;
  onAdd: (product: Product) => void;
  quantity: number;
}

export default function ProductCard({ product, onAdd, quantity }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex gap-3 p-3">
      {/* Image */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-24 h-24 object-cover rounded-xl flex-shrink-0"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
            const placeholder = target.nextElementSibling as HTMLElement | null;
            if (placeholder) placeholder.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className="w-24 h-24 bg-gray-100 rounded-xl flex-shrink-0 items-center justify-center text-3xl"
        style={{ display: product.imageUrl ? 'none' : 'flex' }}
      >
        🍽️
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-brand-600">{formatCurrency(product.price)}</span>
          <button
            onClick={() => onAdd(product)}
            className="relative w-10 h-10 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl flex items-center justify-center transition-all font-bold text-xl shadow-sm"
            aria-label={`${product.name} ekle`}
          >
            +
            {quantity > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {quantity}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
