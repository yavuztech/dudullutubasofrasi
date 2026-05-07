import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, X, ShoppingBag, Tag, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../../stores/productStore';
import { useClothingStore } from '../../stores/clothingStore';
import { formatCurrency } from '../../utils/formatters';
import type { Product, ClothingSale } from '../../types';

// ─── Clothing Product Form (modal) ──────────────────────────────────────────
interface ProductFormProps {
  product?: Product;
  categories: { id: string; name: string }[];
  onClose: () => void;
  nextSortOrder: number;
}

function ClothingProductForm({ product, categories, onClose, nextSortOrder }: ProductFormProps) {
  const { addProduct, updateProduct } = useProductStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name:      product?.name ?? '',
    price:     product?.price?.toString() ?? '',
    category:  product?.category ?? (categories[0]?.id ?? ''),
    available: product?.available ?? true,
    stock:     product?.stock?.toString() ?? '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.category) return;
    setLoading(true);
    try {
      const data = {
        name:        form.name.trim(),
        description: '',
        price:       parseFloat(form.price),
        category:    form.category,
        available:   form.available,
        imageUrl:    '',
        sortOrder:   product?.sortOrder ?? nextSortOrder,
        department:  'clothing' as const,
        stock:       parseInt(form.stock, 10) || 0,
      };
      if (product) {
        await updateProduct(product.id, data);
        toast.success('Ürün güncellendi.');
      } else {
        await addProduct(data);
        toast.success('Ürün eklendi.');
      }
      onClose();
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{product ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Adı *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input"
              placeholder="Ürün adını girin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat (₺) *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="input"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stok Adedi *</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              className="input"
              min="0"
              step="1"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="input"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm text-gray-700">Satışa açık</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? 'Kaydediliyor…' : product ? 'Güncelle' : 'Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Stock Badge ─────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number | undefined }) {
  if (stock === undefined) return null;
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Bitti</span>;
  if (stock <= 5)  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Son {stock} adet</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{stock} adet</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'products' | 'categories' | 'sales';

export default function AdminClothing() {
  const {
    products, categories,
    subscribe, subscribeCategories,
    deleteProduct, toggleAvailability,
    addCategory, updateCategory, deleteCategory,
  } = useProductStore();

  const { sales, subscribeSales } = useClothingStore();

  const [tab, setTab] = useState<Tab>('products');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [newCatName, setNewCatName] = useState('');
  const [showCatInput, setShowCatInput] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Date filter for sales
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    const u3 = subscribeSales();
    return () => { u1(); u2(); u3(); };
  }, []);

  // Only clothing products/categories
  const clothingProducts   = products.filter((p) => p.department === 'clothing');
  const clothingCategories = categories.filter((c) => c.department === 'clothing');

  const handleDeleteProduct = async (product: Product) => {
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
    await addCategory(name, clothingCategories.length, 'clothing');
    toast.success(`"${name}" kategorisi eklendi.`);
    setNewCatName('');
    setShowCatInput(false);
  };

  const handleUpdateCategory = async (id: string) => {
    const name = editingCatName.trim();
    if (!name) return;
    await updateCategory(id, { name });
    toast.success('Kategori güncellendi.');
    setEditingCatId(null);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`"${name}" kategorisi silinsin mi?`)) return;
    await deleteCategory(id);
    toast.success('Kategori silindi.');
  };

  // Filtered sales
  const filteredSales = sales.filter((s) => {
    const d = s.createdAt.toISOString().slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  });
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);

  const TABS: { key: Tab; label: string; icon: typeof ShoppingBag }[] = [
    { key: 'products',   label: 'Ürünler',       icon: Package },
    { key: 'categories', label: 'Kategoriler',   icon: Tag },
    { key: 'sales',      label: 'Satış Geçmişi', icon: ShoppingBag },
  ];

  return (
    <div className="p-4 sm:p-6">
      {/* Tab bar */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditProduct(undefined); setShowForm(true); }}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Ürün Ekle
            </button>
          </div>

          {clothingProducts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Henüz giyim ürünü eklenmedi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {clothingProducts.map((p) => {
                const catName = clothingCategories.find((c) => c.id === p.category)?.name ?? '—';
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-sm text-gray-500">{catName}</p>
                      </div>
                      <StockBadge stock={p.stock} />
                    </div>
                    <p className="font-bold text-brand-600 text-lg">{formatCurrency(p.price)}</p>
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleToggle(p)}
                        title={p.available ? 'Kapat' : 'Aç'}
                        className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                      >
                        {p.available ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => { setEditProduct(p); setShowForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCatInput(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Kategori Ekle
            </button>
          </div>

          {showCatInput && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowCatInput(false); }}
                className="input flex-1"
                placeholder="Kategori adı"
                autoFocus
              />
              <button onClick={handleAddCategory} className="btn-primary">Ekle</button>
              <button onClick={() => setShowCatInput(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}

          {clothingCategories.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Henüz giyim kategorisi eklenmedi.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {clothingCategories.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  {editingCatId === c.id ? (
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(c.id); if (e.key === 'Escape') setEditingCatId(null); }}
                      className="input flex-1 mr-2"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-gray-800">{c.name}</span>
                  )}
                  <div className="flex items-center gap-1">
                    {editingCatId === c.id ? (
                      <>
                        <button onClick={() => handleUpdateCategory(c.id)} className="btn-primary text-sm px-3 py-1.5">Kaydet</button>
                        <button onClick={() => setEditingCatId(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-500">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SALES HISTORY TAB ── */}
      {tab === 'sales' && (
        <div>
          {/* Date filter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bitiş</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">Toplam Ciro</p>
              <p className="text-xl font-bold text-brand-700">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-gray-400">{filteredSales.length} satış</p>
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Bu tarih aralığında satış yok.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredSales.map((sale) => (
                <SaleCard key={sale.id} sale={sale} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product form modal */}
      {showForm && (
        <ClothingProductForm
          product={editProduct}
          categories={clothingCategories}
          onClose={() => { setShowForm(false); setEditProduct(undefined); }}
          nextSortOrder={clothingProducts.length}
        />
      )}
    </div>
  );
}

function SaleCard({ sale }: { sale: ClothingSale }) {
  const time = sale.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const date = sale.createdAt.toLocaleDateString('tr-TR');
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{sale.customerName || 'Müşteri'}</p>
          <p className="text-sm text-gray-400">{date} {time}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-brand-600">{formatCurrency(sale.totalAmount)}</p>
          {sale.discountApplied && (
            <span className="text-xs text-orange-600 font-medium">%{sale.discountRate} indirim</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {sale.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm text-gray-600">
            <span>{item.productName} x{item.quantity}</span>
            <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
