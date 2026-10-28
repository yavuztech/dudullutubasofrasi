import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, ChefHat, X, CheckCircle2, AlertCircle, Pencil, Minus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProductStore } from '../stores/productStore';
import { useTableStore } from '../stores/tableStore';
import { useOrderStore } from '../stores/orderStore';
import { useNotificationStore } from '../stores/notificationStore';
import ProductCard from '../components/customer/ProductCard';
import Cart from '../components/customer/Cart';
import OrderTracker from '../components/customer/OrderTracker';
import NotificationPermissionModal from '../components/shared/NotificationPermissionModal';
import { formatCurrency } from '../utils/formatters';
import { getFCMToken, vibrate } from '../lib/notifications';
import type { CartItem, Order } from '../types';

export default function CustomerMenu() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { products, categories, subscribe, subscribeCategories } = useProductStore();
  const { tables, subscribe: subscribeTables, getTableByQR } = useTableStore();
  const { createOrder, updateOrderItems } = useOrderStore();
  const { createNotification } = useNotificationStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<Order['items']>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const table = useMemo(() => getTableByQR(qrToken ?? ''), [tables, qrToken]);

  // Real-time listener for ALL orders of this table in the current session
  useEffect(() => {
    if (!table) return;
    const q = query(
      collection(db, 'orders'),
      where('tableId', '==', table.id),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered'])
    );
    const unsub = onSnapshot(q, (snap) => {
      const orders: Order[] = snap.docs
        .filter((d) => {
          const sid = d.data().sessionId;
          // If table has a sessionId, only show orders from the same session.
          // Legacy tables without sessionId fall back to showing all orders.
          return !table.sessionId || sid === table.sessionId;
        })
        .map((d) => ({ ...d.data(), id: d.id } as Order));

      setActiveOrders((prev) => {
        // Fire ready notification for newly-ready orders
        orders.forEach((o) => {
          const prevOrder = prev.find((p) => p.id === o.id);
          if (o.status === 'ready' && prevOrder && prevOrder.status !== 'ready') {
            vibrate([300, 100, 300, 100, 300]);
            toast.success(
              o.type === 'table'
                ? `Masa ${o.tableNumber} — Siparişiniz hazır! 🔔`
                : 'Siparişiniz hazır!',
              { duration: 8000 }
            );
          }
        });
        return orders;
      });
    });
    return unsub;
  }, [table?.id, table?.sessionId]);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeCategories();
    const u3 = subscribeTables();
    return () => { u1(); u2(); u3(); };
  }, []);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories]);

  // Listen for status changes on all active orders — removed, replaced by single query listener above

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
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const openEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditItems(order.items.map((i) => ({ ...i })));
  };

  const handleSaveEdit = async () => {
    if (!editingOrder || !table) return;
    const validItems = editItems.filter((i) => i.quantity > 0);
    setEditLoading(true);
    try {
      await updateOrderItems(editingOrder.id, validItems);
      const isCancelled = validItems.length === 0;
      const msg = isCancelled
        ? `Masa ${table.number} — Müşteri siparişi iptal etti`
        : `Masa ${table.number} — Müşteri siparişini düzenledi`;
      await createNotification({ type: 'order_ready_waiter', orderId: editingOrder.id, tableId: table.id, tableNumber: table.number, message: msg, targetRole: 'waiter' });
      toast.success(isCancelled ? 'Sipariş iptal edildi.' : 'Sipariş güncellendi.');
      setEditingOrder(null);
    } catch {
      toast.error('İşlem başarısız. Tekrar deneyin.');
    } finally {
      setEditLoading(false);
    }
  };

  const openConfirm = () => {
    if (!table || cart.length === 0) return;
    setCartOpen(false);
    setShowConfirm(true);
  };

  const handleCheckout = async () => {
    if (!table || cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const fcmToken = await getFCMToken();
      const totalAmount = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      // Check if table needs cleaning first (occupied + dirty edge case)
      const tableNeedsCleaning =
        table.status === 'needs_cleaning' || table.status === 'being_cleaned';

      const orderId = await createOrder({
        type: 'table',
        tableId: table.id,
        tableNumber: table.number,
        ...(table.sessionId ? { sessionId: table.sessionId } : {}),
        items: cart.map((i) => {
          const product = products.find((candidate) => candidate.id === i.productId);
          return {
            productId: i.productId,
            ...(product ? { categoryId: product.category } : {}),
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          };
        }),
        status: 'pending',
        totalAmount,
        ...(fcmToken ? { customerPushToken: fcmToken } : {}),
        ...(tableNeedsCleaning ? { notes: 'MASA_KIRLI' } : {}),
      });

      // Update table status (best-effort — customer may not have write permission)
      try {
        const { updateTableStatus } = useTableStore.getState();
        if (table.status === 'available') {
          await updateTableStatus(table.id, 'occupied', orderId);
        }
      } catch { /* non-critical */ }

      // Create cleaning notification if needed (best-effort)
      if (tableNeedsCleaning) {
        try {
          const { createNotification } = useNotificationStore.getState();
          await createNotification({
            type: 'table_needs_cleaning',
            tableId: table.id,
            tableNumber: table.number,
            message: `Masa ${table.number} müşteri oturdu ama masa temizlenmemiş! Lütfen temizleyin.`,
            targetRole: 'waiter',
          });
        } catch { /* non-critical */ }
      }

      // activeOrders is updated automatically by the query listener
      setCart([]);
      setShowConfirm(false);
      toast.success('Siparişiniz alındı! Mutfak hazırlıyor…');
    } catch (e) {
      console.error('Order creation failed:', e);
      toast.error('Sipariş gönderilemedi. Tekrar deneyin.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!qrToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Geçersiz QR kodu.</p>
      </div>
    );
  }

  if (products.length === 0 && categories.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Menü yükleniyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NotificationPermissionModal />

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Tuba Sofrası</h1>
              {table && (
                <p className="text-[11px] text-gray-400 leading-tight">Masa {table.number}</p>
              )}
            </div>
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-all flex-shrink-0"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{cartCount}</span>
              <span>·</span>
              <span>{formatCurrency(cartTotal)}</span>
            </button>
          )}
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar border-t border-gray-50">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Products */}
      <main className="max-w-2xl mx-auto px-4 py-3 pb-32">
        {categories.length === 0 ? (
          <div className="flex flex-col gap-2.5">
            {availableProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                quantity={cartQuantity(p.id)}
                onAdd={addToCart}
              />
            ))}
          </div>
        ) : (
          <>
            {categories.map((cat) => {
              const items = grouped[cat.id] ?? [];
              if (items.length === 0) return null;
              const isActive = activeCategory === cat.id;
              return (
                <section
                  key={cat.id}
                  id={`cat-${cat.id}`}
                  className={isActive ? 'block' : 'hidden'}
                >
                  <div className="flex flex-col gap-2.5">
                    {items.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        quantity={cartQuantity(p.id)}
                        onAdd={addToCart}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* Floating cart button (mobile) */}
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

      {/* Active orders indicator */}
      {activeOrders.filter(o => o.status !== 'paid' && o.status !== 'cancelled').length > 0 && (
        <div className="fixed bottom-20 right-4 z-20 safe-bottom">
          <button
            onClick={() => setShowOrdersPanel(true)}
            className="bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg flex items-center gap-1.5"
          >
            {activeOrders.filter(o => !['delivered','paid','cancelled'].includes(o.status)).length > 0 && (
              <span className="w-4 h-4 bg-white text-green-700 rounded-full flex items-center justify-center font-bold text-[10px]">
                {activeOrders.filter(o => !['delivered','paid','cancelled'].includes(o.status)).length}
              </span>
            )}
            Siparişlerim ›
          </button>
        </div>
      )}

      {/* Modals */}
      {cartOpen && (
        <Cart
          items={cart}
          onUpdate={updateCart}
          onRemove={removeFromCart}
          onClose={() => setCartOpen(false)}
          onCheckout={openConfirm}
          checkoutLoading={checkoutLoading}
        />
      )}

      {/* Order confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="p-5 pb-3 text-center border-b border-gray-100">
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-brand-600" />
              </div>
              <h2 className="font-bold text-gray-900 text-lg">Siparişinizi Onaylayın</h2>
              <p className="text-sm text-gray-500 mt-1">Aşağıdaki ürünleri sipariş etmek istiyor musunuz?</p>
            </div>

            {/* Item list */}
            <div className="px-5 py-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-brand-600 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {item.quantity}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{item.productName}</span>
                  </div>
                  <span className="text-sm text-gray-500 ml-3 flex-shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-5 pb-2 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="font-semibold text-gray-700">Toplam</span>
              <span className="font-bold text-brand-600 text-lg">{formatCurrency(cartTotal)}</span>
            </div>

            {/* Warning */}
            <div className="mx-5 mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Sipariş verildikten sonra mutfağa iletilir. Lütfen listeden emin olun.</p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-6 flex flex-col gap-2">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {checkoutLoading ? 'Sipariş Veriliyor…' : 'Evet, Sipariş Ver'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setCartOpen(true); }}
                disabled={checkoutLoading}
                className="w-full py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Vazgeç, Sepete Dön
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders panel */}
      {showOrdersPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowOrdersPanel(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Siparişlerim</h2>
              <button onClick={() => setShowOrdersPanel(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
              {/* Active orders */}
              {[...activeOrders].filter(o => !['delivered','paid','cancelled'].includes(o.status)).reverse().map((order) => (
                <div key={order.id}>
                  <OrderTracker order={order} inline />
                  {['pending', 'preparing'].includes(order.status) && (
                    <button
                      onClick={() => { setShowOrdersPanel(false); openEditOrder(order); }}
                      className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 py-2 rounded-xl transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Siparişi Düzenle / İptal Et
                    </button>
                  )}
                </div>
              ))}
              {/* Delivered orders */}
              {activeOrders.filter(o => o.status === 'delivered').length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">Teslim Edilenler</p>
                  {[...activeOrders].filter(o => o.status === 'delivered').reverse().map((order) => (
                    <OrderTracker key={order.id} order={order} inline />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Order edit modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingOrder(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">Siparişi Düzenle</h2>
              <button onClick={() => setEditingOrder(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
              {editItems.map((item, idx) => (
                <div key={item.productId} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-brand-600 font-bold">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter((_, j) => j !== idx || prev[idx].quantity - 1 > 0))}
                      className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-red-50 hover:border-red-200"
                    >
                      {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5 text-gray-600" />}
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>
              ))}
              {editItems.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Tüm ürünler kaldırıldı — sipariş iptal edilecek.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
              <button onClick={() => setEditingOrder(null)} className="btn-secondary flex-1">Vazgeç</button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className={`flex-1 flex items-center justify-center gap-2 ${editItems.length === 0 ? 'btn-danger' : 'btn-primary'} disabled:opacity-60`}
              >
                {editLoading ? 'Kaydediliyor…' : editItems.length === 0 ? 'Siparişi İptal Et' : 'Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
