import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Tag, X, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../../stores/productStore';
import ProductForm from '../../components/kitchen/ProductForm';
import { formatCurrency } from '../../utils/formatters';
import type { Product, Category } from '../../types';

const KITCHEN_STATIONS = [
  { value: undefined, label: 'Yok' },
  { value: 'station1', label: 'Fırın' },
  { value: 'station2', label: 'Izgara' },
  { value: 'station3', label: 'Kasa (manuel fiş)' },
  { value: 'station4', label: 'Burger' },
] as const;

export default function AdminProducts() {
  const { products, categories, subscribe, subscribeCategories, deleteProduct, toggleAvailability, addCategory, updateCategory, deleteCategory } =
    useProductStore();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [filterCat, setFilterCat] = useState<string>('all');
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    return () => { u1(); u2(); };
  }, []);

  const handleDelete = async (product: Product) => {
    if (!confirm(`"${product.name}" silinsin mi?`)) return;
    await deleteProduct(product.id);
    toast.success('Ürün silindi.');
  };

  const handleToggle = async (product: Product) => {
    await toggleAvailability(product.id, !product.available);
    toast.success(product.available ? 'Ürün kapatıldı.' : 'Ürün açıldı.');
  };

  const handleSaveCategory = async (data: { name: string; kitchenStation?: string }) => {
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, data);
        toast.success('Kategori güncellendi.');
      } else {
        await addCategory(data.name, categories.length, 'food', data.kitchenStation);
        toast.success('Kategori eklendi.');
      }
      setShowCatForm(false);
      setEditingCat(null);
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`"${name}" kategorisi silinsin mi? Bu kategorideki ürünler kategorisiz kalır.`)) return;
    await deleteCategory(id);
    if (filterCat === id) setFilterCat('all');
    toast.success('Kategori silindi.');
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
            <div key={c.id} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setFilterCat(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${filterCat === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {c.name}
                {c.kitchenStation && <Printer className="w-3 h-3" />}
              </button>
              <button
                onClick={() => { setEditingCat(c); setShowCatForm(true); }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Düzenle"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDeleteCategory(c.id, c.name)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Sil"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setEditingCat(null); setShowCatForm(true); }}
            className="btn-secondary flex items-center gap-2 text-sm py-2 px-3"
          >
            <Tag className="w-4 h-4" />
            Kategori Ekle
          </button>
          <button
            onClick={() => { setEditProduct(undefined); setShowForm(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ürün Ekle
          </button>
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
                <button
                  onClick={() => handleDelete(p)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Ürün bulunamadı</p>
          <p className="text-sm mt-1">Yeni ürün eklemek için + butonuna tıklayın.</p>
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

      {showCatForm && (
        <CategoryFormModal
          category={editingCat}
          onSave={handleSaveCategory}
          onClose={() => { setShowCatForm(false); setEditingCat(null); }}
        />
      )}
    </div>
  );
}

// ─── Category Form Modal ─────────────────────────────────────────────────────
interface CategoryFormProps {
  category: Category | null;
  onSave: (data: { name: string; kitchenStation?: string }) => void;
  onClose: () => void;
}

function CategoryFormModal({ category, onSave, onClose }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [kitchenStation, setKitchenStation] = useState<string | undefined>(category?.kitchenStation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), kitchenStation });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{category ? 'Kategori Düzenle' : 'Yeni Kategori'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Ana Yemekler, İçecekler vb."
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mutfak İstasyonu <span className="text-gray-400 text-xs">(Fiş Yazdırma)</span>
            </label>
            <select
              value={kitchenStation ?? ''}
              onChange={(e) => setKitchenStation(e.target.value || undefined)}
              className="input"
            >
              {KITCHEN_STATIONS.map((s) => (
                <option key={s.value ?? 'none'} value={s.value ?? ''}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              İstasyonu olmayan kategoriler otomatik basılmaz. Fırın, Izgara ve Burger ürünleri seçilen mutfak yazıcısına; Kasa seçimi yalnızca kasiyer ekranındaki manuel fişe yönlendirir.
            </p>
          </div>
          <button type="submit" className="btn-primary mt-2">
            {category ? 'Güncelle' : 'Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
