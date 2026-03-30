import { useEffect, useState } from 'react';
import { useOrderStore } from '../../stores/orderStore';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Package, UtensilsCrossed } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  pending:    { label: 'Bekliyor',     color: 'bg-yellow-100 text-yellow-700' },
  preparing:  { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700' },
  ready:      { label: 'Hazır',        color: 'bg-green-100 text-green-700' },
  delivered:  { label: 'Teslim',       color: 'bg-gray-100 text-gray-600' },
  paid:       { label: 'Ödendi',       color: 'bg-brand-100 text-brand-700' },
  cancelled:  { label: 'İptal',        color: 'bg-red-100 text-red-600' },
};

type DateFilter = 'today' | 'week' | 'month' | 'all';

function startOf(filter: DateFilter): Date | null {
  const now = new Date();
  if (filter === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (filter === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

export default function AdminOrders() {
  const { orders, subscribe } = useOrderStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  useEffect(() => {
    // Subscribe to delivered + paid + cancelled (closed orders)
    const unsub = subscribe(['delivered', 'paid', 'cancelled']);
    return unsub;
  }, []);

  const from = startOf(dateFilter);
  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchDate   = !from || o.createdAt >= from;
    return matchStatus && matchDate;
  });

  // Summary stats
  const paidOrders   = filtered.filter((o) => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const tableCount   = filtered.filter((o) => o.type === 'table').length;
  const takeawayCount = filtered.filter((o) => o.type === 'takeaway').length;

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="p-4 sm:p-6">
      <h2 className="font-bold text-gray-800 mb-4">Sipariş Geçmişi</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['today', 'week', 'month', 'all'] as DateFilter[]).map((d) => (
          <button
            key={d}
            onClick={() => setDateFilter(d)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              dateFilter === d ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {{ today: 'Bugün', week: 'Son 7 Gün', month: 'Bu Ay', all: 'Tümü' }[d]}
          </button>
        ))}
        <div className="w-px bg-gray-200 self-stretch mx-1" />
        {(['all', 'delivered', 'paid', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === 'all' ? 'Tüm Durumlar' : STATUS_LABELS[s].label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-600">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Toplam Ciro (Ödendi)</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Toplam Sipariş</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800">{tableCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Masa Siparişi</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800">{takeawayCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Gel Al Siparişi</p>
        </div>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Sipariş bulunamadı</p>
          <p className="text-sm mt-1">Seçili filtre için kayıt yok.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...filtered].reverse().map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => toggle(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, expanded, onToggle }: { order: Order; expanded: boolean; onToggle: () => void }) {
  const st = STATUS_LABELS[order.status];
  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
          {order.type === 'table'
            ? <UtensilsCrossed className="w-4 h-4 text-gray-500" />
            : <Package className="w-4 h-4 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">
            {order.type === 'table' ? `Masa ${order.tableNumber}` : `Gel Al — ${order.customerName ?? ''}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(order.createdAt, 'd MMM yyyy, HH:mm', { locale: tr })}
            {' · '}{order.items.length} ürün
          </p>
        </div>
        <span className={`badge text-xs ${st.color}`}>{st.label}</span>
        <span className="font-bold text-gray-800 text-sm ml-2">{formatCurrency(order.totalAmount)}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left pb-1 font-medium">Ürün</th>
                <th className="text-center pb-1 font-medium">Adet</th>
                <th className="text-right pb-1 font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-gray-700">{item.productName}</td>
                  <td className="py-1.5 text-center text-gray-500">{item.quantity}</td>
                  <td className="py-1.5 text-right font-medium text-gray-800">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-2 text-xs text-gray-400 font-medium uppercase">Toplam</td>
                <td className="pt-2 text-right font-bold text-brand-600">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          {order.notes && (
            <p className="text-xs text-gray-400 mt-2">Not: {order.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
