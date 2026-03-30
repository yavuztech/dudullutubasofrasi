import { useEffect, useState } from 'react';
import { Edit2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../../stores/productStore';
import ProductForm from '../../components/kitchen/ProductForm';
import { formatCurrency } from '../../utils/formatters';
import type { Product } from '../../types';

export default function KitchenProducts() {
  const { products, categories, subscribe, subscribeCategories, toggleAvailability } =
    useProductStore();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [filterCat, setFilterCat] = useState<string>('all');

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    return () => { u1(); u2(); };
  }, []);

  const handleToggle = async (product: Product) => {
    await toggleAvailability(product.id, !product.available);
    toast.success(product.available ? 'Ürün kapatıldı.' : 'Ürün açıldı.');
  };

  const filtered = filterCat === 'all' ? products : products.filter((p) => p.category === filterCat);

  return (
    <div className="p-4 sm:p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Tümü
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((p) => (
          <div key={p.id} className={`card flex gap-3 ${!p.available ? 'opacity-60' : ''}`}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl">🍽️</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{p.name}</h3>
                {!p.available && (
                  <span className="badge bg-red-100 text-red-700 flex-shrink-0 text-[10px]">Kapalı</span>
                )}
              </div>
              {p.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
              )}
              <p className="font-bold text-brand-600 mt-1 text-sm">{formatCurrency(p.price)}</p>

              {/* Actions */}
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => handleToggle(p)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                    p.available
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {p.available ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {p.available ? 'Kapat' : 'Aç'}
                </button>
                <button
                  onClick={() => { setEditProduct(p); setShowForm(true); }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium"
                >
                  <Edit2 className="w-3 h-3" />
                  Düzenle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Ürün bulunamadı</p>
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          categories={categories}
          onClose={() => { setShowForm(false); setEditProduct(undefined); }}
          nextSortOrder={products.length}
        />
      )}
    </div>
  );
}
