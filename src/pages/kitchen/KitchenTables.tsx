import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, LayoutGrid, QrCode, X, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useTableStore } from '../../stores/tableStore';
import { useOrderStore } from '../../stores/orderStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { tableStatusColor, tableStatusLabel, formatCurrency } from '../../utils/formatters';
import type { Order, Table } from '../../types';

export default function KitchenTables() {
  const { tables, subscribe: subscribeTables, updateTableStatus } = useTableStore();
  const { orders, subscribe: subscribeOrders, updateOrderStatus } = useOrderStore();
  const { createNotification } = useNotificationStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const baseUrl = window.location.origin;

  useEffect(() => {
    const u1 = subscribeTables();
    const u2 = subscribeOrders(['pending', 'preparing', 'ready', 'delivered']);
    return () => { u1(); u2(); };
  }, []);

  const getTableOrder = (tableId: string): Order | undefined =>
    orders.find((o) => o.tableId === tableId && ['pending', 'preparing', 'ready', 'delivered'].includes(o.status));

  const handleCloseTable = async (tableId: string, tableNumber: number) => {
    const order = getTableOrder(tableId);
    if (!order) return;
    setLoadingId(tableId);
    try {
      // Mark order as paid
      await updateOrderStatus(order.id, 'paid');
      // Mark table as needs_cleaning
      await updateTableStatus(tableId, 'needs_cleaning', undefined);
      // Notify waiter
      await createNotification({
        type: 'table_needs_cleaning',
        tableId,
        tableNumber,
        message: `Masa ${tableNumber} kapandı — temizlenmesi gerekiyor 🧹`,
        targetRole: 'waiter',
      });
      toast.success(`Masa ${tableNumber} kapatıldı, garson bilgilendirildi.`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center mb-4">
        <h2 className="flex items-center gap-2 font-bold text-gray-800">
          <LayoutGrid className="w-5 h-5 text-brand-600" />
          Masa Durumu
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tables.map((table) => {
          const order = getTableOrder(table.id);
          return (
            <div key={table.id} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Masa {table.number}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQrTable(table)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                    title="QR Kodu Göster"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <span className={`badge text-xs ${tableStatusColor(table.status)}`}>
                    {tableStatusLabel(table.status)}
                  </span>
                </div>
              </div>

              {order && (
                <div className="text-xs text-gray-600">
                  <p>{order.items.length} kalem</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                </div>
              )}

              {table.status === 'occupied' && order && (
                <button
                  onClick={() => handleCloseTable(table.id, table.number)}
                  disabled={loadingId === table.id}
                  className="mt-auto btn-success text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {loadingId === table.id ? 'İşleniyor…' : 'Ödeme Al & Kapat'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Henüz masa yok</p>
          <p className="text-sm mt-1">Admin panelinden masa eklenebilir.</p>
        </div>
      )}

      {/* QR Modal */}
      {qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setQrTable(null)}>
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <p className="font-bold text-xl text-gray-900">Masa {qrTable.number}</p>
              <button onClick={() => setQrTable(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <QRCodeCanvas
              id={`qr-kitchen-${qrTable.number}`}
              value={`${baseUrl}/menu/${qrTable.qrToken}`}
              size={220}
              level="H"
              includeMargin
            />
            <p className="text-xs text-gray-400 break-all max-w-[220px] text-center">
              {`${baseUrl}/menu/${qrTable.qrToken}`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const canvas = document.getElementById(`qr-kitchen-${qrTable.number}`) as HTMLCanvasElement;
                  if (!canvas) return;
                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a'); a.href = url; a.download = `masa-${qrTable.number}-qr.png`; a.click();
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                İndir
              </button>
              <button onClick={() => setQrTable(null)} className="btn-secondary">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
