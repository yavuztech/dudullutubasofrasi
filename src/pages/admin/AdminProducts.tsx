import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Tag, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../../stores/productStore';
import ProductForm from '../../components/kitchen/ProductForm';
import { formatCurrency } from '../../utils/formatters';
import type { Product } from '../../types';

export default function AdminProducts() {
  const { products, categories, subscribe, subscribeCategories, deleteProduct, toggleAvailability, addCategory, updateCategory, deleteCategory } =
    useProductStore();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [filterCat, setFilterCat] = useState<string>('all');
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

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

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    await addCategory(name, categories.length);
    toast.success(`"${name}" kategorisi eklendi.`);
    setNewCatName('');
    setShowCatInput(false);
  };

  const handleUpdateCategory = async (id: string) => {
    const name = editingCatName.trim();
    if (!name) return;
    await updateCategory(id, name);
    toast.success('Kategori güncellendi.');
    setEditingCatId(null);
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
              {editingCatId === c.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editingCatName}
                    onChange={(e) => setEditingCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(c.id); if (e.key === 'Escape') setEditingCatId(null); }}
                    className="px-2 py-1 text-sm border border-brand-400 rounded-lg outline-none w-28"
                    autoFocus
                  />
                  <button onClick={() => handleUpdateCategory(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingCatId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setFilterCat(c.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {c.name}
                  </button>
                  <button
                    onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }}
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
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCatInput(true)}
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

      {/* Category input popup */}
      {showCatInput && (
        <div className="mb-4 flex gap-2 items-center bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowCatInput(false); }}
            placeholder="Kategori adı (ör: Ana Yemekler)"
            className="input flex-1"
            autoFocus
          />
          <button onClick={handleAddCategory} className="btn-primary text-sm py-2 px-4">Ekle</button>
          <button onClick={() => { setShowCatInput(false); setNewCatName(''); }} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

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
    </div>
  );
}
