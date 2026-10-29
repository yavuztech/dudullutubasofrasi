import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, Send, ChefHat, ClipboardList, Trash2, Search, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProductStore } from '../../stores/productStore';
import { useOrderStore } from '../../stores/orderStore';
import { useTableStore } from '../../stores/tableStore';
import { formatCurrency } from '../../utils/formatters';
import { getTableDisplayName } from '../../utils/tableUtils';
import type { CartItem, Order, OrderItem, Table } from '../../types';

interface Props {
  table: Table;
  onClose: () => void;
}

type Tab = 'new' | 'existing';

const STATUS_LABEL: Record<string, string> = {
  pending:   'Bekliyor',
  preparing: 'Hazırlanıyor',
  ready:     'Hazır',
  delivered: 'Teslim Edildi',
};

function toDate(v: unknown): Date {
  if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
  if (v instanceof Date) return v;
  return new Date();
}

export default function WaiterOrderSheet({ table, onClose }: Props) {
  const { products, categories } = useProductStore();
  const { createOrder, updateOrderItems, requestKitchenPrint } = useOrderStore();
  const { updateTableStatus } = useTableStore();

  const [tab, setTab] = useState<Tab>('new');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [reprintConfirmOrder, setReprintConfirmOrder] = useState<Order | null>(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  // Existing orders for this table/session
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('tableId', '==', table.id),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
      where('tableSection', '==', table.section ?? 'normal'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs
        .map((d) => ({
          ...(d.data() as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
          id: d.id,
          createdAt: toDate(d.data().createdAt),
          updatedAt: toDate(d.data().updatedAt),
        } as Order))
        .filter((o) => !table.sessionId || o.sessionId === table.sessionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setActiveOrders(orders);
    });
    return unsub;
  }, [table.id, table.sessionId]);

  const available = products.filter((p) => p.available);
  const filteredProducts = useMemo(() => {
    const queryText = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return available.filter((p) => {
      const matchCategory = !activeCategory || activeCategory === 'all' || p.category === activeCategory;
      const matchSearch = !queryText || p.name.toLocaleLowerCase('tr-TR').includes(queryText);
      return matchCategory && matchSearch;
    });
  }, [available, activeCategory, searchQuery]);

  // ── New order ──────────────────────────────────────────────────────────────
  const qty = (productId: string) => cart.find((i) => i.productId === productId)?.quantity ?? 0;
  const isItemTakeaway = (productId: string) => !!cart.find((i) => i.productId === productId)?.isTakeaway;

  const add = (product: (typeof products)[0]) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.productId === product.id);
      if (ex) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1, isTakeaway: false }];
    });
  };
  const toggleTakeaway = (productId: string) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, isTakeaway: !i.isTakeaway } : i));
  };
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  };
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const handleSend = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const orderId = await createOrder({
        type: 'table',
        tableId: table.id,
        tableNumber: table.number,
        tableLabel: getTableDisplayName(table),
        tableSection: table.section ?? 'normal',
        ...(table.sessionId ? { sessionId: table.sessionId } : {}),
        items: cart.map((i) => {
          const product = products.find((candidate) => candidate.id === i.productId);
          return {
            productId: i.productId,
            ...(product ? { categoryId: product.category } : {}),
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            isTakeaway: !!i.isTakeaway,
            notes: i.isTakeaway ? (i.notes ? `${i.notes} (Paket)` : '(Paket)') : i.notes,
          };
        }),
        status: 'pending',
        totalAmount: cartTotal,
      });
      if (table.status === 'available') {
        await updateTableStatus(table.id, 'occupied', orderId);
      }
      toast.success(`${getTableDisplayName(table)} sipariş mutfağa gönderildi!`);
      setCart([]);
      setTab('existing');
    } catch {
      toast.error('Sipariş gönderilemedi. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // ── Edit existing order ────────────────────────────────────────────────────
  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setEditItems(order.items.map((i) => ({ ...i })));
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    const validItems = editItems.filter((i) => i.quantity > 0);
    setEditLoading(true);
    try {
      await updateOrderItems(editingOrder.id, validItems);
      toast.success(validItems.length === 0 ? 'Sipariş iptal edildi.' : 'Sipariş güncellendi.');
      setEditingOrder(null);
    } catch {
      toast.error('İşlem başarısız.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleRequestKitchenPrint = async () => {
    if (!reprintConfirmOrder) return;
    setReprintLoading(true);
    try {
      await requestKitchenPrint(reprintConfirmOrder.id);
      toast.success('Tekrar yazdırma isteği kaydedildi. Bridge çevrimdışıysa bağlandığında yazdıracak.');
      setReprintConfirmOrder(null);
    } catch (error) {
      console.error('Mutfak fişi tekrar yazdırma isteği kaydedilemedi:', error);
      toast.error('Tekrar yazdırma isteği kaydedilemedi. Ağ bağlantısını kontrol edip yeniden deneyin.');
    } finally {
      setReprintLoading(false);
    }
  };

  const editableStatuses = ['pending', 'preparing'];


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{getTableDisplayName(table)}</p>
              <p className="text-[11px] text-gray-400">Sipariş yönetimi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setTab('new')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'new' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'
            }`}
          >
            <Plus className="w-4 h-4" />
            Yeni Sipariş
            {cartCount > 0 && (
              <span className="w-5 h-5 bg-brand-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{cartCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'existing' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Mevcut Siparişler
            {activeOrders.length > 0 && (
              <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${tab === 'existing' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{activeOrders.length}</span>
            )}
          </button>
        </div>

        {/* ── Yeni Sipariş tab ── */}
        {tab === 'new' && (
          <>
            <div className="p-3 pb-2 border-b border-gray-100 flex flex-col gap-2 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ürün adı ara..."
                  className="input pl-9 py-2 text-sm w-full"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-semibold">
                    ✕
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    activeCategory === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Tümü
                </button>
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
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Aranan kriterde ürün bulunamadı.
                </div>
              ) : filteredProducts.map((product) => {
                const count = qty(product.id);
                const isTakeaway = isItemTakeaway(product.id);
                return (
                  <div key={product.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    {product.imageUrl && (
                      <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-900 text-sm truncate">{product.name}</p>
                        {count > 0 && isTakeaway && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 flex items-center gap-0.5">
                            <Package className="w-2.5 h-2.5" /> (Paket)
                          </span>
                        )}
                      </div>
                      <p className="text-brand-600 font-bold text-sm">{formatCurrency(product.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {count > 0 ? (
                        <>
                          <button
                            onClick={() => toggleTakeaway(product.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${
                              isTakeaway
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                            }`}
                            title="Paket sipariş olarak işaretle"
                          >
                            <Package className="w-3 h-3" />
                            {isTakeaway ? 'Paket' : 'Masa'}
                          </button>
                          <button onClick={() => removeFromCart(product.id)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                          <span className="w-5 text-center font-bold text-sm">{count}</span>
                        </>
                      ) : <span className="w-8" />}
                      <button onClick={() => add(product)} className="w-8 h-8 bg-brand-600 text-white rounded-xl flex items-center justify-center hover:bg-brand-700 active:scale-95 transition-transform">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              {cartCount > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{cartCount} ürün</p>
                      <p className="font-bold text-gray-900">{formatCurrency(cartTotal)}</p>
                    </div>
                  </div>
                  <button onClick={() => setConfirmSend(true)} disabled={loading} className="btn-primary flex items-center gap-2 px-5 py-2.5 flex-shrink-0 disabled:opacity-60">
                    <Send className="w-4 h-4" />
                    {loading ? 'Gönderiliyor…' : 'Mutfağa Gönder'}
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-1">Ürün seçin</p>
              )}
            </div>
          </>
        )}

        {/* ── Mevcut Siparişler tab ── */}
        {tab === 'existing' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {activeOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Aktif sipariş yok</p>
              </div>
            ) : activeOrders.map((order) => {
              const canEdit = editableStatuses.includes(order.status);
              const isEditing = editingOrder?.id === order.id;
              return (
                <div key={order.id} className="bg-gray-50 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge text-xs ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <span className="text-xs text-gray-400">{order.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {isEditing ? (
                    // Edit mode
                    <div className="flex flex-col gap-2">
                      {editItems.map((item, idx) => (
                        <div key={item.productId} className="flex items-center gap-3 bg-white rounded-xl p-2.5">
                          <p className="flex-1 text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0))}
                              className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-red-50"
                            >
                              {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-gray-600" />}
                            </button>
                            <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                            <button
                              onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}
                              className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
                            >
                              <Plus className="w-3 h-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {editItems.length === 0 && (
                        <p className="text-xs text-center text-orange-600 py-2">Tüm ürünler kaldırıldı — sipariş iptal edilecek.</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setEditingOrder(null)} className="btn-secondary flex-1 py-2 text-xs">Vazgeç</button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={editLoading}
                          className={`flex-1 py-2 text-xs flex items-center justify-center gap-1 ${editItems.length === 0 ? 'btn-danger' : 'btn-primary'} disabled:opacity-60`}
                        >
                          {editLoading ? 'Kaydediliyor…' : editItems.length === 0 ? 'İptal Et' : 'Kaydet'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-0.5">
                          <span className="text-gray-700">{item.productName} <span className="text-gray-400">×{item.quantity}</span></span>
                          <span className="font-medium text-gray-900">{formatCurrency(item.unitPrice * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                        <span className="font-bold text-gray-900 text-sm">{formatCurrency(order.totalAmount)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReprintConfirmOrder(order)}
                            className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mutfağa Tekrar Gönder
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => openEdit(order)}
                              className="text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setConfirmSend(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg">Siparişi mutfağa göndermek istiyor musunuz?</h3>
            <p className="text-sm text-gray-600 mt-2">
              <strong>{getTableDisplayName(table)}</strong> için {cartCount} ürün, toplam {formatCurrency(cartTotal)} tutarında sipariş mutfağa gönderilecek.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmSend(false)}
                disabled={loading}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  setConfirmSend(false);
                  void handleSend();
                }}
                disabled={loading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? 'Gönderiliyor…' : 'Evet, mutfağa gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reprintConfirmOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !reprintLoading && setReprintConfirmOrder(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg">Sipariş fişi yeniden gönderilsin mi?</h3>
            <p className="text-sm text-gray-600 mt-2">
              <strong>{getTableDisplayName(table)}</strong> için bu siparişin mutfak fişi tekrar yazdırılmak üzere istasyonlara gönderilecek.
              Yeni sipariş veya ek hesap oluşturulmaz. Yazıcı çevrimdışıysa istek bridge bağlandığında işlenir.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setReprintConfirmOrder(null)}
                disabled={reprintLoading}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={() => void handleRequestKitchenPrint()}
                disabled={reprintLoading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {reprintLoading ? 'İstek gönderiliyor…' : 'Evet, tekrar gönder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
