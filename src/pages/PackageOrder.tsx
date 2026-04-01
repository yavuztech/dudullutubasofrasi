import { useEffect, useState, useMemo, useRef } from 'react';
import { ChefHat, ShoppingCart, X, Search, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProductStore } from '../stores/productStore';
import { useOrderStore } from '../stores/orderStore';
import { useSettingsStore } from '../stores/settingsStore';
import ProductCard from '../components/customer/ProductCard';
import Cart from '../components/customer/Cart';
import OrderTracker from '../components/customer/OrderTracker';
import PhoneVerification from '../components/customer/PhoneVerification';
import KvkkModal from '../components/customer/KvkkModal';
import NotificationPermissionModal from '../components/shared/NotificationPermissionModal';
import { formatCurrency } from '../utils/formatters';
import { getFCMToken, vibrate } from '../lib/notifications';
import type { CartItem, Order } from '../types';

export default function PackageOrder() {
  const { products, categories, subscribe, subscribeCategories } = useProductStore();
  const { createOrder } = useOrderStore();
  const { settings, subscribe: subscribeSettings } = useSettingsStore();

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Direct checkout (SMS verification OFF)
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directKvkkAccepted, setDirectKvkkAccepted] = useState(false);

  // WhatsApp checkout
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waName, setWaName] = useState('');
  const [waKvkkAccepted, setWaKvkkAccepted] = useState(false);
  const [showWaKvkk, setShowWaKvkk] = useState(false);

  // Order tracking by phone
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackPhone, setTrackPhone] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const trackUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    const u3 = subscribeSettings();
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories]);

  // Watch order status
  useEffect(() => {
    if (!activeOrder) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const { onSnapshot, doc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      unsub = onSnapshot(doc(db, 'orders', activeOrder.id), (snap) => {
        if (!snap.exists()) return;
        const updated = { ...activeOrder, ...snap.data(), id: snap.id } as Order;
        setActiveOrder(updated);
        if (updated.status === 'ready' && activeOrder.status !== 'ready') {
          vibrate([300, 100, 300, 100, 300]);
          toast.success('🎉 Siparişiniz Hazır! Gelebilirsiniz.', { duration: 10000 });
        }
      });
    })();
    return () => unsub?.();
  }, [activeOrder?.id]);

  const availableProducts = products.filter((p) => p.available);
  const grouped = useMemo(() => {
    const map: Record<string, typeof products> = {};
    for (const p of availableProducts) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [availableProducts]);

  const cartQuantity = (productId: string) =>
    cart.find((i) => i.productId === productId)?.quantity ?? 0;
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1 }];
    });
  };

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  };

  const toDate = (v: unknown): Date => {
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    if (v instanceof Date) return v;
    return new Date();
  };

  const handleTrackOrder = async () => {
    setTrackingError('');
    setTrackedOrder(null);
    const formatted = trackPhone.startsWith('+') ? trackPhone : `+90${trackPhone.replace(/^0/, '')}`;
    if (!/^\+90\d{10}$/.test(formatted)) {
      setTrackingError('Geçerli bir Türkiye numarası girin (5xx xxx xx xx)');
      return;
    }
    setTrackingLoading(true);
    trackUnsubRef.current?.();
    try {
      const { onSnapshot, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const q = query(
        collection(db, 'orders'),
        where('customerPhone', '==', formatted),
        where('type', '==', 'takeaway'),
      );
      trackUnsubRef.current = onSnapshot(q, (snap) => {
        const orders = snap.docs
          .map(d => {
            const data = d.data() as Record<string, unknown>;
            return {
              ...(data as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
              id: d.id,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            } as Order;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const active = orders.find(o => ['pending', 'preparing', 'ready'].includes(o.status));
        const found = active ?? orders[0] ?? null;
        setTrackedOrder(found);
        setTrackingLoading(false);
        if (!found) setTrackingError('Bu telefon numarasına ait sipariş bulunamadı.');
      }, () => {
        setTrackingLoading(false);
        setTrackingError('Sipariş sorgulanamadı. Tekrar deneyin.');
      });
    } catch {
      setTrackingLoading(false);
      setTrackingError('Bir hata oluştu.');
    }
  };

  const closeTracking = () => {
    setTrackingOpen(false);
    setTrackPhone('');
    setTrackedOrder(null);
    setTrackingError('');
    trackUnsubRef.current?.();
    trackUnsubRef.current = null;
  };

  // Called from Cart's primary checkout button
  const handleCartCheckout = () => {
    setCartOpen(false);
    if (!settings.phoneVerification) {
      setDirectKvkkAccepted(false);
      setShowDirectModal(true);
    } else if (!verifiedPhone) {
      setShowPhoneModal(true);
    } else {
      placeOrder(verifiedPhone);
    }
  };

  // Called from Cart's WhatsApp button
  const handleWhatsAppCheckout = () => {
    setCartOpen(false);
    setWaName(customerName);
    setWaKvkkAccepted(false);
    setShowWhatsAppModal(true);
  };

  // Open WhatsApp with pre-filled order message
  const openWhatsApp = () => {
    const lines = cart
      .map((i) => `\u2022 ${i.productName} x${i.quantity} \u2013 ${formatCurrency(i.unitPrice * i.quantity)}`)
      .join('\n');
    const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const nameStr = waName.trim() ? `\nAd: ${waName.trim()}` : '';
    const message = `Merhaba! 🍽️ Tuba Sofras\u0131 Gel Al Sipari\u015fim:\n\n${lines}\n\nToplam: ${formatCurrency(total)}${nameStr}`;
    const num = settings.whatsappNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
    setShowWhatsAppModal(false);
    setCart([]);
  };

  // Called after phone verified
  const handlePhoneVerified = (phone: string) => {
    setVerifiedPhone(phone);
    setShowPhoneModal(false);
    placeOrder(phone);
  };

  const placeOrder = async (phone: string) => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const totalAmount = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const orderItems = cart.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
      const orderId = await createOrder({
        type: 'takeaway',
        items: orderItems,
        status: 'pending',
        ...(phone ? { customerPhone: phone } : {}),
        customerName: customerName || undefined,
        totalAmount,
      });
      setActiveOrder({
        id: orderId, type: 'takeaway',
        items: orderItems,
        status: 'pending', customerPhone: phone, totalAmount,
        createdAt: new Date(), updatedAt: new Date(),
      });
      setCart([]);
      setCartOpen(false);
      toast.success('Siparişiniz alındı!');
      if ('Notification' in window && Notification.permission !== 'granted') {
        setShowNotifPrompt(true);
      }
      // FCM token'ı arka planda al ve siparişe ekle (sipariş akışını bloke etmez)
      getFCMToken().then((fcmToken) => {
        if (fcmToken) {
          import('firebase/firestore').then(({ updateDoc, doc }) =>
            import('../lib/firebase').then(({ db }) =>
              updateDoc(doc(db, 'orders', orderId), { customerPushToken: fcmToken })
            )
          ).catch(() => { /* FCM token kaydedilemediyse sipariş etkilenmez */ });
        }
      }).catch(() => { /* ignore */ });
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      toast.error(`Sipariş gönderilemedi: ${msg}${code ? ` [${code}]` : ''}`, { duration: 10000 });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NotificationPermissionModal
        forceShow={showNotifPrompt}
        onClose={() => setShowNotifPrompt(false)}
        onGranted={() => setShowNotifPrompt(false)}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Restaurant icon */}
            <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col gap-0.5 justify-center min-w-0">
              <span className="font-extrabold text-gray-900 text-base leading-tight tracking-tight">Tuba Sofrası</span>
              <span className="text-[11px] text-brand-500 font-semibold leading-tight">Gel Al Siparişi</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setTrackingOpen(true)}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Sipariş Takibi</span>
            </button>
            {cartCount > 0 && (
              <button
                onClick={() => setCartOpen(true)}
                className="flex items-center gap-1.5 bg-brand-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{cartCount}</span>
              </button>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Menu */}
      <main className="px-4 py-3 pb-32">
        {categories.map((cat) => {
          const items = grouped[cat.id] ?? [];
          if (items.length === 0 || activeCategory !== cat.id) return null;
          return (
            <section key={cat.id}>
              <div className="flex flex-col gap-2.5">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} quantity={cartQuantity(p.id)} onAdd={addToCart} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-3 safe-bottom sm:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="btn-primary w-full flex items-center justify-between shadow-xl rounded-2xl py-3.5 px-4"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-semibold">{cartCount} Ürün</span>
            </div>
            <span className="font-bold">{formatCurrency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <Cart
          items={cart}
          onUpdate={updateCart}
          onRemove={(id) => setCart((prev) => prev.filter((i) => i.productId !== id))}
          onClose={() => setCartOpen(false)}
          onCheckout={handleCartCheckout}
          checkoutLoading={checkoutLoading}
          onWhatsAppCheckout={
            settings.whatsappEnabled && settings.whatsappNumber
              ? handleWhatsAppCheckout
              : undefined
          }
        />
      )}

      {/* Phone verification modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPhoneModal(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Telefon Doğrulama</h3>
              <button onClick={() => setShowPhoneModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adınız Soyadınız (İsteğe bağlı)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ad Soyad"
                className="input"
              />
            </div>

            {/* KVKK onayı */}
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={kvkkAccepted}
                onChange={(e) => setKvkkAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Kişisel verilerimin (ad soyad ve telefon numarası) yalnızca sipariş takibi
                amacıyla işleneceğini, üçüncü kişilerle paylaşılmayacağını bildiren{' '}
                <button
                  type="button"
                  onClick={() => setShowKvkk(true)}
                  className="text-brand-600 font-medium underline underline-offset-2"
                >
                  KVKK Aydınlatma Metni
                </button>
                'ni okudum ve onaylıyorum.
              </span>
            </label>

            {!kvkkAccepted && (
              <p className="text-xs text-red-500 mb-3">Devam edebilmek için KVKK metnini onaylamanız gerekmektedir.</p>
            )}

            <div className={kvkkAccepted ? '' : 'pointer-events-none opacity-40'}>
              <PhoneVerification onVerified={handlePhoneVerified} />
            </div>
          </div>
        </div>
      )}

      {/* Direct checkout modal (phone verification OFF) */}
      {showDirectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDirectModal(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Siparişi Onayla</h3>
              <button onClick={() => setShowDirectModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adınız Soyadınız (İsteğe bağlı)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ad Soyad"
                className="input"
              />
            </div>
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={directKvkkAccepted}
                onChange={(e) => setDirectKvkkAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Kişisel verilerimin (ad soyad) yalnızca sipariş takibi amacıyla işleneceğini bildiren{' '}
                <button type="button" onClick={() => setShowKvkk(true)} className="text-brand-600 font-medium underline underline-offset-2">
                  KVKK Aydınlatma Metni
                </button>
                'ni okudum ve onaylıyorum.
              </span>
            </label>
            {!directKvkkAccepted && (
              <p className="text-xs text-red-500 mb-3">Devam edebilmek için KVKK metnini onaylamanız gerekmektedir.</p>
            )}
            <button
              onClick={() => { setShowDirectModal(false); placeOrder(''); }}
              disabled={!directKvkkAccepted || checkoutLoading}
              className="btn-primary w-full disabled:opacity-40"
            >
              {checkoutLoading ? 'Sipariş Veriliyor…' : 'Sipariş Ver'}
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp checkout modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowWhatsAppModal(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">WhatsApp ile Sipariş Ver</h3>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Seçtiğiniz ürünler WhatsApp mesajı olarak hazırlanacak. Mesajı doğrudan gönderebileceksiniz.
            </p>

            {/* Order summary */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              {cart.map((i) => (
                <div key={i.productId} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-700">{i.productName} <span className="text-gray-400">×{i.quantity}</span></span>
                  <span className="font-medium text-gray-900">{formatCurrency(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-200">
                <span>Toplam</span>
                <span>{formatCurrency(cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adınız Soyadınız (İsteğe bağlı)</label>
              <input
                type="text"
                value={waName}
                onChange={(e) => setWaName(e.target.value)}
                placeholder="Ad Soyad"
                className="input"
              />
            </div>

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={waKvkkAccepted}
                onChange={(e) => setWaKvkkAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Kişisel verilerimin (ad soyad) sipariş amacıyla işleneceğini bildiren{' '}
                <button type="button" onClick={() => setShowWaKvkk(true)} className="text-brand-600 font-medium underline underline-offset-2">
                  KVKK Aydınlatma Metni
                </button>
                'ni okudum ve onaylıyorum.
              </span>
            </label>

            <button
              onClick={openWhatsApp}
              disabled={!waKvkkAccepted}
              className="w-full flex items-center justify-center gap-2 bg-green-600 disabled:opacity-40 text-white py-3 rounded-2xl font-semibold hover:bg-green-700 transition-colors text-sm"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp'ta Aç ve Gönder
            </button>
          </div>
        </div>
      )}

      {activeOrder && (
        <OrderTracker order={activeOrder} onClose={() => setActiveOrder(null)} />
      )}

      {showKvkk && <KvkkModal onClose={() => setShowKvkk(false)} />}
      {showWaKvkk && <KvkkModal onClose={() => setShowWaKvkk(false)} />}

      {/* Order tracking modal */}
      {trackingOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeTracking} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Sipariş Takibi</h3>
              <button onClick={closeTracking} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Sipariş verirken kullandığınız telefon numarasını girin.</p>
            <div className="flex gap-2 mb-4">
              <input
                type="tel"
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
                placeholder="5xx xxx xx xx"
                className="input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
              />
              <button
                onClick={handleTrackOrder}
                disabled={trackingLoading}
                className="btn-primary px-4"
              >
                {trackingLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
            {trackingError && (
              <p className="text-sm text-red-500 mb-3">{trackingError}</p>
            )}
            {trackedOrder && (
              <OrderTracker order={trackedOrder} inline />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
