import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LayoutGrid, Sparkles, CheckCircle, AlertTriangle, QrCode, X, Download, ClipboardList, DoorOpen, ArrowLeftRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTableStore } from '../../stores/tableStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useProductStore } from '../../stores/productStore';
import WaiterOrderSheet from '../../components/waiter/WaiterOrderSheet';
import TableTransferModal from '../../components/shared/TableTransferModal';
import { tableStatusColor, tableStatusLabel, formatCurrency } from '../../utils/formatters';
import { getTableDisplayName } from '../../utils/tableUtils';
import type { Table } from '../../types';

export default function WaiterTables() {
  const { tables, subscribe, updateTableStatus, newSession } = useTableStore();
  const { createNotification } = useNotificationStore();
  const { subscribe: subscribeProducts, subscribeCategories } = useProductStore();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [orderTable, setOrderTable] = useState<Table | null>(null);
  const [transferTable, setTransferTable] = useState<Table | null>(null);
  const [activeTab, setActiveTab] = useState<'normal' | 'family'>('normal');
  const baseUrl = window.location.origin;
  const [unpaidWarning, setUnpaidWarning] = useState<{
    tableId: string; tableNumber: number; total: number;
  } | null>(null);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeProducts();
    const u3 = subscribeCategories();
    return () => { u1(); u2(); u3(); };
  }, []);

  const checkUnpaid = async (tableId: string): Promise<number> => {
    const snap = await getDocs(query(
      collection(db, 'orders'),
      where('tableId', '==', tableId),
      where('status', '==', 'delivered'),
    ));
    return snap.docs.reduce((s, d) => s + ((d.data().totalAmount as number) ?? 0), 0);
  };

  const handleMarkCleaned = async (tableId: string, tableNumber: number, skipCheck = false) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    // Check for unpaid orders unless explicitly skipped
    if (!skipCheck) {
      setLoadingId(tableId);
      const unpaidTotal = await checkUnpaid(tableId);
      setLoadingId(null);
      if (unpaidTotal > 0) {
        setUnpaidWarning({ tableId, tableNumber, total: unpaidTotal });
        return;
      }
    }
    setLoadingId(tableId);
    try {
      await updateTableStatus(tableId, 'available', undefined);
      await createNotification({
        type: 'table_cleaned',
        tableId,
        tableNumber,
        message: `${getTableDisplayName(table)} temizlendi ve hazır. ✅`,
        targetRole: 'kitchen',
      });
      toast.success(`${getTableDisplayName(table)} temizlendi!`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleCloseTable = async (tableId: string, tableNumber: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    setLoadingId(tableId);
    try {
      // Yeni oturum başlat — eski siparişler yeni müşteriye karışmaz
      await newSession(tableId);
      await updateTableStatus(tableId, 'needs_cleaning', undefined);
      await createNotification({
        type: 'table_needs_cleaning',
        tableId,
        tableNumber,
        message: `${getTableDisplayName(table)} kapatıldı — temizlenmesi gerekiyor 🧹`,
        targetRole: 'waiter',
      });
      toast.success(`${getTableDisplayName(table)} kapatıldı.`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleStartCleaning = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    setLoadingId(tableId);
    try {
      await updateTableStatus(tableId, 'being_cleaned', undefined);
      toast(`${getTableDisplayName(table)} temizleniyor…`, { icon: '🧹' });
    } finally {
      setLoadingId(null);
    }
  };

  const needsCleaning = tables.filter(
    (t) => t.status === 'needs_cleaning' || t.status === 'being_cleaned'
  );

  // Filter tables by active tab
  const filteredTables = tables.filter((t) => 
    activeTab === 'family' ? t.section === 'family' : (!t.section || t.section === 'normal')
  );
  
  const filteredNeedsCleaning = needsCleaning.filter((t) => 
    activeTab === 'family' ? t.section === 'family' : (!t.section || t.section === 'normal')
  );

  const normalTablesCount = tables.filter((t) => !t.section || t.section === 'normal').length;
  const familyTablesCount = tables.filter((t) => t.section === 'family').length;

  return (
    <div className="p-4 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-gray-800 mb-4">
        <LayoutGrid className="w-5 h-5 text-brand-600" />
        Masa Durumu
      </h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('normal')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'normal'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🍽️ Masalar ({normalTablesCount})
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'family'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          👨‍👩‍👧‍👦 Aile Bölümü ({familyTablesCount})
        </button>
      </div>

      {/* Tables needing cleaning — highlighted */}
      {filteredNeedsCleaning.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4" />
            Temizlenmesi Gereken Masalar
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredNeedsCleaning.map((table) => (
              <div key={table.id} className="card border-2 border-orange-300 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{getTableDisplayName(table)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQrTable(table)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400" title="QR Göster">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <span className={`badge text-xs ${tableStatusColor(table.status)}`}>
                      {tableStatusLabel(table.status)}
                    </span>
                  </div>
                </div>

                {table.status === 'needs_cleaning' && (
                  <button
                    onClick={() => handleStartCleaning(table.id)}
                    disabled={loadingId === table.id}
                    className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    🧹 Temizlemeye Başla
                  </button>
                )}

                {table.status === 'being_cleaned' && (
                  <button
                    onClick={() => handleMarkCleaned(table.id, table.number)}
                    disabled={loadingId === table.id}
                    className="btn-success text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {loadingId === table.id ? 'İşleniyor…' : 'Masa Temizlendi'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredTables.map((table) => {
          const isBeingCleaned = table.status === 'being_cleaned';
          return (
            <div
              key={table.id}
              className="card flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{getTableDisplayName(table)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQrTable(table)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400" title="QR Göster">
                    <QrCode className="w-4 h-4" />
                  </button>
                  <span className={`badge text-xs ${tableStatusColor(table.status)}`}>
                    {tableStatusLabel(table.status)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400">{table.capacity} kişilik</p>
              {!isBeingCleaned && (
                <button
                  onClick={() => setOrderTable(table)}
                  className="w-full flex items-center justify-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Sipariş Al
                </button>
              )}
              {table.status === 'occupied' && (
                <button
                  onClick={() => handleCloseTable(table.id, table.number)}
                  disabled={loadingId === table.id}
                  className="w-full flex items-center justify-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  {loadingId === table.id ? 'İşleniyor…' : 'Masayı Kapat'}
                </button>
              )}
              {table.status === 'occupied' && (
                <button
                  onClick={() => setTransferTable(table)}
                  className="w-full flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Aktar / Birleştir
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filteredTables.length === 0 && tables.length > 0 && (
        <div className="text-center py-16 text-gray-400">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold">Bu bölümde masa yok</p>
          <p className="text-sm mt-1">Admin panelinden masa eklenebilir.</p>
        </div>
      )}

      {tables.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Henüz masa tanımlanmamış</p>
          <p className="text-sm mt-1">Admin panelinden masa eklenebilir.</p>
        </div>
      )}

      {transferTable && (
        <TableTransferModal
          sourceTable={transferTable}
          onClose={() => setTransferTable(null)}
        />
      )}

      {/* QR Modal */}
      {qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setQrTable(null)}>
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <p className="font-bold text-xl text-gray-900">{getTableDisplayName(qrTable)}</p>
              <button onClick={() => setQrTable(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <QRCodeCanvas
              id={`qr-waiter-${qrTable.number}`}
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
                  const canvas = document.getElementById(`qr-waiter-${qrTable.number}`) as HTMLCanvasElement;
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

      {/* Unpaid orders warning modal */}
      {unpaidWarning && (() => {
        const warningTable = tables.find((t) => t.id === unpaidWarning.tableId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setUnpaidWarning(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Ödenmemiş Sipariş!</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>{warningTable ? getTableDisplayName(warningTable) : `Masa ${unpaidWarning.tableNumber}`}</strong> için{' '}
                    <strong className="text-orange-600">{formatCurrency(unpaidWarning.total)}</strong>{' '}
                    tutarında ödenmemiş sipariş var.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Ödeme almadan masayı temizlemek istiyorsanız onaylayın. Hesap için müşteriyi <strong>Kasa</strong>'ya yönlendirin.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setUnpaidWarning(null)}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  const { tableId, tableNumber } = unpaidWarning;
                  setUnpaidWarning(null);
                  handleMarkCleaned(tableId, tableNumber, true);
                }}
                className="btn-danger flex-1"
              >
                Yine de Temizle
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Waiter order sheet */}
      {orderTable && (
        <WaiterOrderSheet
          table={orderTable}
          onClose={() => setOrderTable(null)}
        />
      )}
    </div>
  );
}
