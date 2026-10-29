import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LayoutGrid, QrCode, X, Download, ClipboardList, ArrowLeftRight, Split, Plus, Minus } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuthStore } from '../../stores/authStore';
import { useTableStore } from '../../stores/tableStore';
import { useProductStore } from '../../stores/productStore';
import WaiterOrderSheet from '../../components/waiter/WaiterOrderSheet';
import TableTransferModal from '../../components/shared/TableTransferModal';
import { tableStatusColor, tableStatusLabel } from '../../utils/formatters';
import { getTableDisplayName } from '../../utils/tableUtils';
import type { Table } from '../../types';

export default function WaiterTables() {
  const { tables, subscribe, splitTable, unsplitTable } = useTableStore();
  const { user } = useAuthStore();
  const { subscribe: subscribeProducts, subscribeCategories } = useProductStore();
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [orderTable, setOrderTable] = useState<Table | null>(null);
  const [transferTable, setTransferTable] = useState<Table | null>(null);
  const [activeTab, setActiveTab] = useState<'normal' | 'family' | 'ladies'>('normal');
  const [splitTableTarget, setSplitTableTarget] = useState<Table | null>(null);
  const [splitCapacities, setSplitCapacities] = useState<number[]>([]);
  const baseUrl = window.location.origin;

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeProducts();
    const u3 = subscribeCategories();
    return () => { u1(); u2(); u3(); };
  }, []);

  const isAdmin = user?.roles.includes('admin') ?? false;
  const hasLadiesRole = user?.roles.includes('waiter_ladies') ?? false;
  const hasRegularWaiterRole = user?.roles.includes('waiter') ?? false;
  const selectedSection = hasLadiesRole && !hasRegularWaiterRole && !isAdmin ? 'ladies' : activeTab;
  const ladiesOnly = !isAdmin && hasLadiesRole && !hasRegularWaiterRole;
  const visibleTables = tables.filter((table) => !ladiesOnly || table.section === 'ladies');

  // Filter tables by active tab
  const filteredTables = visibleTables.filter((t) =>
    selectedSection === 'family' ? t.section === 'family' : selectedSection === 'ladies'
      ? t.section === 'ladies'
      : (!t.section || t.section === 'normal')
  );
  const normalTablesCount = visibleTables.filter((t) => !t.section || t.section === 'normal').length;
  const familyTablesCount = visibleTables.filter((t) => t.section === 'family').length;
  const ladiesTablesCount = visibleTables.filter((t) => t.section === 'ladies').length;

  return (
    <div className="p-4 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-gray-800 mb-4">
        <LayoutGrid className="w-5 h-5 text-brand-600" />
        Masa Durumu
      </h2>

      {/* Tab Navigation */}
      {!ladiesOnly && (
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
        {isAdmin && (
          <button
            onClick={() => setActiveTab('ladies')}
            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
              activeTab === 'ladies' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500'
            }`}
          >
            Hanım Kafeteryası ({ladiesTablesCount})
          </button>
        )}
      </div>
      )}

      {/* All tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredTables.map((table) => {
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
              <button
                onClick={() => setOrderTable(table)}
                className="w-full flex items-center justify-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold py-2 rounded-xl transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Sipariş Al
              </button>
              {!table.parentTableId && table.capacity > 1 && (
                <button
                  onClick={() => {
                    setSplitTableTarget(table);
                    setSplitCapacities([1, table.capacity - 1]);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  <Split className="w-3.5 h-3.5" />
                  Masayı Böl
                </button>
              )}
              {table.parentTableId === table.id && table.splitGroupIds?.every((gid) => tables.find((t) => t.id === gid)?.status === 'available') && (
                <button
                  onClick={async () => {
                    try {
                      await unsplitTable(table.id);
                      toast.success(`${getTableDisplayName(table)} bölünmesi kaldırıldı.`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Bölünme kaldırılamadı.');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  <Split className="w-3.5 h-3.5" />
                  Bölünmeyi Kaldır
                </button>
              )}
              {table.status === 'occupied' && (
                <button
                  onClick={() => setTransferTable(table)}
                  disabled={!!table.parentTableId}
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
              id={`qr-waiter-${qrTable.id}`}
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
                  const canvas = document.getElementById(`qr-waiter-${qrTable.id}`) as HTMLCanvasElement;
                  if (!canvas) return;
                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a'); a.href = url; a.download = `${getTableDisplayName(qrTable).replaceAll(' ', '-')}-qr.png`; a.click();
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

      {/* Waiter order sheet */}
      {orderTable && (
        <WaiterOrderSheet
          table={orderTable}
          onClose={() => setOrderTable(null)}
        />
      )}

      {splitTableTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSplitTableTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg">Masayı ayrı hesaplara böl</h3>
            <p className="text-sm text-gray-600 mt-1">
              {getTableDisplayName(splitTableTarget)} ({splitTableTarget.capacity} kişilik) bölündüğünde her alt masa ayrı sipariş ve hesap tutar.
              Mevcut sipariş varsa {getTableDisplayName({ ...splitTableTarget, displayName: `${splitTableTarget.number}_1` })} üzerinde kalır.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              {splitCapacities.map((capacity, index) => (
                <label key={index} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                  <span>{getTableDisplayName({ ...splitTableTarget, displayName: `${splitTableTarget.number}_${index + 1}` })}</span>
                  <input
                    type="number"
                    min={1}
                    max={splitTableTarget.capacity}
                    value={capacity}
                    onChange={(event) => {
                      const next = [...splitCapacities];
                      next[index] = Number(event.target.value);
                      setSplitCapacities(next);
                    }}
                    className="input w-24"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className={`text-xs font-medium ${
                splitCapacities.reduce((sum, capacity) => sum + capacity, 0) === splitTableTarget.capacity
                  ? 'text-green-700' : 'text-red-600'
              }`}>
                Toplam: {splitCapacities.reduce((sum, capacity) => sum + capacity, 0)} / {splitTableTarget.capacity} kişi
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitCapacities((current) => current.length > 2 ? current.slice(0, -1) : current)}
                  disabled={splitCapacities.length <= 2}
                  className="btn-secondary p-2 disabled:opacity-40"
                  aria-label="Son alt masayı kaldır"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSplitCapacities((current) => current.length < splitTableTarget.capacity
                    ? [...current, 1]
                    : current)}
                  disabled={splitCapacities.length >= splitTableTarget.capacity}
                  className="btn-secondary p-2 disabled:opacity-40"
                  aria-label="Alt masa ekle"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSplitTableTarget(null)} className="btn-secondary flex-1">Vazgeç</button>
              <button
                onClick={async () => {
                  try {
                    await splitTable(splitTableTarget.id, splitCapacities);
                    toast.success(`${getTableDisplayName(splitTableTarget)} ayrı hesaplara bölündü.`);
                    setSplitTableTarget(null);
                  } catch (error) {
                    console.error('Masa bölünemedi:', error);
                    toast.error(error instanceof Error ? error.message : 'Masa bölünemedi.');
                  }
                }}
                disabled={splitCapacities.some((capacity) => !Number.isInteger(capacity) || capacity < 1)
                  || splitCapacities.reduce((sum, capacity) => sum + capacity, 0) !== splitTableTarget.capacity}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Böl ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
