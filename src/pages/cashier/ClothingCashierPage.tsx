import { useEffect, useState, useMemo } from 'react';
import { ShoppingCart, Minus, Plus, Users, Trash2, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../../stores/productStore';
import { useClothingStore } from '../../stores/clothingStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCurrency } from '../../utils/formatters';
import type { Product, ClothingSaleItem } from '../../types';

interface CartItem {
  product: Product;
  quantity: number;
}

// ─── Stock Badge ─────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number | undefined }) {
  if (stock === undefined) return null;
  if (stock === 0) return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Bitti</span>;
  if (stock <= 5) return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">Son {stock}</span>;
  return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">{stock} adet</span>;
}

export default function ClothingCashierPage() {
  const { products, categories, subscribe, subscribeCategories } = useProductStore();
  const { createSale } = useClothingStore();
  const { settings, subscribe: subscribeSettings } = useSettingsStore();

  const [activeCat, setActiveCat] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [staffDiscount, setStaffDiscount] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    const u3 = subscribeSettings();
    return () => { u1(); u2(); u3(); };
  }, []);

  // Only clothing products that are available
  const clothingProducts   = useMemo(() => products.filter((p) => p.department === 'clothing'), [products]);
  const clothingCategories = useMemo(() => categories.filter((c) => c.department === 'clothing'), [categories]);

  const displayedProducts = useMemo(
    () => activeCat === 'all' ? clothingProducts : clothingProducts.filter((p) => p.category === activeCat),
    [clothingProducts, activeCat],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );

  const discountRate = staffDiscount && settings.staffDiscount ? (settings.staffDiscountRate ?? 0) : 0;
  const discountAmt  = cartTotal * (discountRate / 100);
  const finalTotal   = cartTotal - discountAmt;

  const handleAddToCart = (product: Product) => {
    if ((product.stock ?? 1) === 0) return; // stock = 0 → disabled

    // Check in-cart quantity doesn't exceed stock
    const inCart = cart.find((i) => i.product.id === product.id)?.quantity ?? 0;
    if (product.stock !== undefined && inCart >= product.stock) {
      toast.error(`"${product.name}" için yeterli stok yok. Mevcut: ${product.stock}`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleQtyChange = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.product.id !== productId) return [item];
        const newQty = item.quantity + delta;
        if (newQty <= 0) return [];
        // Cap at stock
        if (item.product.stock !== undefined && newQty > item.product.stock) {
          toast.error(`Stok yetersiz. Mevcut: ${item.product.stock}`);
          return [item];
        }
        return [{ ...item, quantity: newQty }];
      }),
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handlePay = async () => {
    if (cart.length === 0) return;
    setPaying(true);
    try {
      const items: ClothingSaleItem[] = cart.map((c) => ({
        productId:   c.product.id,
        productName: c.product.name,
        quantity:    c.quantity,
        unitPrice:   c.product.price,
      }));
      await createSale({
        items,
        customerName: customerName.trim() || undefined,
        totalAmount:  finalTotal,
        discountApplied: discountRate > 0,
        discountRate,
      });
      toast.success('Satış tamamlandı!');
      setCart([]);
      setCustomerName('');
      setStaffDiscount(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ödeme alınamadı.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left: Products ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Category filter */}
        <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar flex-shrink-0">
          <button
            onClick={() => setActiveCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tümü
          </button>
          {clothingCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingBag className="w-12 h-12 opacity-30" />
              <p>Bu kategoride ürün yok.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {displayedProducts.map((p) => {
                const outOfStock = (p.stock ?? 1) === 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    disabled={outOfStock || !p.available}
                    className={`relative text-left bg-white rounded-2xl border p-3 transition-all flex flex-col gap-1 ${
                      outOfStock || !p.available
                        ? 'opacity-50 border-gray-200 cursor-not-allowed'
                        : 'border-gray-200 hover:border-brand-400 hover:shadow-sm active:scale-95'
                    }`}
                  >
                    {(outOfStock) && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-red-500/90 text-white text-xs font-bold px-2 py-1 rounded-lg rotate-[-10deg]">Bitti</span>
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{p.name}</p>
                      <StockBadge stock={p.stock} />
                    </div>
                    <p className="font-bold text-brand-600">{formatCurrency(p.price)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart ── */}
      <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col max-h-[55vh] lg:max-h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <ShoppingCart className="w-5 h-5 text-brand-600" />
          <span className="font-semibold text-gray-900">Sepet</span>
          {cart.length > 0 && (
            <span className="ml-auto text-sm text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} ürün</span>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 py-8">
              <ShoppingCart className="w-10 h-10" />
              <p className="text-sm">Sepet boş</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.product.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleQtyChange(item.product.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => handleQtyChange(item.product.id, +1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 w-16 text-right">
                    {formatCurrency(item.product.price * item.quantity)}
                  </p>
                  <button onClick={() => handleRemoveFromCart(item.product.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 p-4 flex flex-col gap-3 flex-shrink-0">
            {/* Customer name */}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Müşteri adı (isteğe bağlı)"
              className="input text-sm"
            />

            {/* Staff discount toggle */}
            {settings.staffDiscount && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staffDiscount}
                  onChange={(e) => setStaffDiscount(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600"
                />
                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                  <Users className="w-4 h-4 text-brand-600" />
                  Personel indirimi (%{settings.staffDiscountRate ?? 0})
                </span>
              </label>
            )}

            {/* Totals */}
            <div className="flex flex-col gap-1">
              {discountRate > 0 && (
                <>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Ara toplam</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>İndirim (%{discountRate})</span>
                    <span>−{formatCurrency(discountAmt)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-gray-900">
                <span>Toplam</span>
                <span className="text-brand-600 text-lg">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="btn-primary w-full"
            >
              {paying ? 'İşleniyor…' : 'Ödeme Al'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
