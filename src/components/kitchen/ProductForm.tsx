import { useState, useRef } from 'react';
import { X, ImageIcon, Upload, Loader2, DollarSign } from 'lucide-react';
import { useProductStore } from '../../stores/productStore';
import type { Product } from '../../types';

const CLOUDINARY_CLOUD = 'dlg5ymqpu';
const CLOUDINARY_PRESET = 'wagqko2z';

interface Props {
  product?: Product;
  categories: { id: string; name: string }[];
  onClose: () => void;
  nextSortOrder: number;
}

export default function ProductForm({ product, categories, onClose, nextSortOrder }: Props) {
  const { addProduct, updateProduct } = useProductStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:        product?.name ?? '',
    description: product?.description ?? '',
    price:       product?.price?.toString() ?? '',
    category:    product?.category ?? (categories[0]?.id ?? ''),
    available:   product?.available ?? true,
    imageUrl:    product?.imageUrl ?? '',
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', CLOUDINARY_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: data,
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      const json = await res.json();
      setForm((f) => ({ ...f, imageUrl: json.secure_url }));
    } catch {
      alert('Görsel yüklenemedi, tekrar deneyin.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) return;
    setLoading(true);
    try {
      const data = {
        name:        form.name.trim(),
        description: form.description.trim(),
        price:       parseFloat(form.price),
        category:    form.category,
        available:   form.available,
        imageUrl:    form.imageUrl.trim(),
        sortOrder:   product?.sortOrder ?? nextSortOrder,
      };

      if (product) {
        await updateProduct(product.id, data);
      } else {
        await addProduct(data);
      }

      onClose();
    } catch (e) {
      alert('Kaydedilemedi: ' + (e instanceof Error ? e.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{product ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ürün Görseli</label>
            <div className="flex gap-2 items-start">
              {/* Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Yükleniyor…</span></>
                  : <><Upload className="w-4 h-4" /><span>Görsel Yükle</span></>}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }}
              />
              {/* Preview */}
              {form.imageUrl ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={form.imageUrl}
                    alt="Önizleme"
                    className="w-14 h-14 object-cover rounded-xl border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">JPG, PNG veya WebP — otomatik olarak Cloudinary'e yüklenir</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ürün Adı *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Örn: Adana Kebap"
              className="input"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Kısa ürün açıklaması…"
              className="input resize-none"
              rows={2}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fiyat (₺) *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                className="input pl-9"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Availability */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm({ ...form, available: !form.available })}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.available ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {form.available ? 'Satışta' : 'Satışta Değil'}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Kaydediliyor…' : product ? 'Güncelle' : 'Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
