import { useEffect, useState } from 'react';
import { Plus, QrCode, Download, Package, X, Trash2, AlertTriangle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useTableStore } from '../../stores/tableStore';
import { getTableDisplayName } from '../../utils/tableUtils';
import type { TableSection } from '../../types';

export default function AdminTables() {
  const { tables, subscribe, addTable, deleteTable, unsplitTable } = useTableStore();
  const [qrTable, setQrTable] = useState<typeof tables[0] | null>(null);
  const [showTakeawayQR, setShowTakeawayQR] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<typeof tables[0] | null>(null);
  const [form, setForm] = useState({ section: 'normal' as TableSection, capacity: 4 });

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  const baseUrl = window.location.origin;

  const handleAddTable = async () => {
    const rootTables = tables.filter((table) => !table.parentTableId || table.parentTableId === table.id);
    const normalTables = rootTables.filter((t) => !t.section || t.section === 'normal');
    const familyTables = rootTables.filter((t) => t.section === 'family');
    const ladiesTables = rootTables.filter((t) => t.section === 'ladies');
    
    const maxNormal = normalTables.length ? Math.max(...normalTables.map((t) => t.number)) : 0;
    const maxFamily = familyTables.length ? Math.max(...familyTables.map((t) => t.number)) : 0;
    
    const maxLadies = ladiesTables.length ? Math.max(...ladiesTables.map((t) => t.number)) : 0;
    const nextNumber = form.section === 'family' ? maxFamily + 1 : form.section === 'ladies' ? maxLadies + 1 : maxNormal + 1;
    
    await addTable(nextNumber, form.capacity, form.section);
    const displayName = form.section === 'ladies' ? `H-${nextNumber}` : form.section === 'family' ? `Aile - ${nextNumber}` : `Masa ${nextNumber}`;
    toast.success(`${displayName} eklendi.`);
    setShowAddForm(false);
    setForm({ section: 'normal', capacity: 4 });
  };

  const handleDeleteTable = async () => {
    if (!deleteConfirm) return;
    const displayName = getTableDisplayName(deleteConfirm);
    await deleteTable(deleteConfirm.id);
    toast.success(`${displayName} silindi.`);
    setDeleteConfirm(null);
  };

  const handleDownloadQR = (tableId: string, fileName: string) => {
    const canvas = document.getElementById(`qr-${tableId}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-qr.png`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6">

      {/* Gel Al QR card */}
      <div className="card mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" />
            Gel Al (Paket Sipariş) QR
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Bu QR kodu kasanıza veya kapı girişine asın. Müşteriler tarayarak sipariş verebilir.
          </p>
          <p className="text-xs text-gray-400 mt-1 break-all">{`${baseUrl}/order`}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowTakeawayQR(true)}
            className="btn-secondary flex items-center gap-2 text-sm py-2"
          >
            <QrCode className="w-4 h-4" />
            QR Göster
          </button>
          <button
            onClick={() => {
              const canvas = document.getElementById('qr-takeaway') as HTMLCanvasElement;
              if (!canvas) return;
              const url = canvas.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = url; a.download = 'gel-al-qr.png'; a.click();
            }}
            className="btn-secondary flex items-center gap-2 text-sm py-2"
          >
            <Download className="w-4 h-4" />
            İndir
          </button>
        </div>
        {/* Hidden canvas for download */}
        <div className="hidden">
          <QRCodeCanvas id="qr-takeaway" value={`${baseUrl}/order`} size={512} level="H" />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800">Masa & QR Yönetimi</h2>
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" />
          Masa Ekle
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tables.map((table) => {
          const displayName = getTableDisplayName(table);
          return (
          <div key={table.id} className="card flex flex-col gap-3 items-center text-center">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900">{displayName}</p>
              {table.section === 'family' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Aile</span>
              )}
              {table.section === 'ladies' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">Hanım Kafeteryası</span>
              )}
              {table.parentTableId && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Bölünmüş</span>
              )}
            </div>

            {/* Hidden canvas used for QR download */}
            <div className="hidden">
              <QRCodeCanvas
                id={`qr-${table.id}`}
                value={`${baseUrl}/menu/${table.qrToken}`}
                size={256}
                level="H"
              />
            </div>

            <button
              onClick={() => setQrTable(table)}
              className="flex flex-col items-center gap-1 text-brand-600 hover:text-brand-700"
            >
              <QrCode className="w-8 h-8" />
              <span className="text-xs font-medium">QR Göster</span>
            </button>

            <button
              onClick={() => handleDownloadQR(table.id, displayName.replaceAll(' ', '-'))}
              className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 w-full justify-center"
            >
              <Download className="w-3 h-3" />
              İndir
            </button>
            
            {table.parentTableId === table.id && table.splitGroupIds?.every((gid) => tables.find((t) => t.id === gid)?.status === 'available') && (
              <button
                onClick={async () => {
                  try {
                    await unsplitTable(table.id);
                    toast.success(`${displayName} bölünmesi kaldırıldı.`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Bölünme kaldırılamadı.');
                  }
                }}
                className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 w-full justify-center text-purple-700 bg-purple-50 hover:bg-purple-100"
              >
                Bölünmeyi Kaldır
              </button>
            )}

            {!table.parentTableId && (
              <button
                onClick={() => setDeleteConfirm(table)}
                className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 w-full justify-center text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                <Trash2 className="w-3 h-3" />
                Sil
              </button>
            )}
          </div>
        );
        })}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Henüz masa yok</p>
          <p className="text-sm mt-1">Yukarıdaki "Masa Ekle" butonunu kullanarak ekleyebilirsiniz.</p>
        </div>
      )}

      {/* Add Table Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddForm(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Yeni Masa Ekle</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bölüm</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, section: 'normal' }))}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      form.section === 'normal'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🍽️ Masalar
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, section: 'family' }))}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      form.section === 'family'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👨‍👩‍👧‍👦 Aile Bölümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, section: 'ladies' }))}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      form.section === 'ladies'
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Hanım Kafeteryası
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kapasite</label>
                <select
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  className="input"
                >
                  {[2, 4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>{n} Kişi</option>
                  ))}
                </select>
              </div>
              
              <button onClick={handleAddTable} className="btn-primary mt-2">
                Masa Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Takeaway QR Modal */}
      {showTakeawayQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowTakeawayQR(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-xl text-gray-900">Gel Al Siparişi</p>
            <QRCodeCanvas value={`${baseUrl}/order`} size={220} level="H" includeMargin />
            <p className="text-xs text-gray-400 break-all max-w-[220px] text-center">{`${baseUrl}/order`}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const canvas = document.getElementById('qr-takeaway') as HTMLCanvasElement;
                  if (!canvas) return;
                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a'); a.href = url; a.download = 'gel-al-qr.png'; a.click();
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                İndir
              </button>
              <button onClick={() => setShowTakeawayQR(false)} className="btn-secondary">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrTable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setQrTable(null)}
        >
          <div
            className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-xl text-gray-900">{getTableDisplayName(qrTable)}</p>
            <QRCodeCanvas
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
                onClick={() => handleDownloadQR(qrTable.id, getTableDisplayName(qrTable).replaceAll(' ', '-'))}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Masayı Sil</h3>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>{getTableDisplayName(deleteConfirm)}</strong> silinecek.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Bu işlem geri alınamaz. Masayla ilişkili QR kod da silinecektir.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDeleteTable}
                className="btn-danger flex-1"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
