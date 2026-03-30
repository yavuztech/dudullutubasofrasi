import { useEffect, useState } from 'react';
import { Plus, QrCode, Download, Package } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useTableStore } from '../../stores/tableStore';

export default function AdminTables() {
  const { tables, subscribe, addTable } = useTableStore();
  const [qrTable, setQrTable] = useState<typeof tables[0] | null>(null);
  const [showTakeawayQR, setShowTakeawayQR] = useState(false);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  const baseUrl = window.location.origin;

  const handleAddTable = async () => {
    const max = tables.length ? Math.max(...tables.map((t) => t.number)) : 0;
    await addTable(max + 1, 4);
    toast.success(`Masa ${max + 1} eklendi.`);
  };

  const handleDownloadQR = (tableNumber: number) => {
    const canvas = document.getElementById(`qr-${tableNumber}`) as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `masa-${tableNumber}-qr.png`;
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
        <button onClick={handleAddTable} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" />
          Masa Ekle
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tables.map((table) => (
          <div key={table.id} className="card flex flex-col gap-3 items-center text-center">
            <p className="font-bold text-gray-900">Masa {table.number}</p>

            {/* Hidden canvas used for QR download */}
            <div className="hidden">
              <QRCodeCanvas
                id={`qr-${table.number}`}
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
              onClick={() => handleDownloadQR(table.number)}
              className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 w-full justify-center"
            >
              <Download className="w-3 h-3" />
              İndir
            </button>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-semibold">Henüz masa yok</p>
          <button onClick={handleAddTable} className="btn-primary mt-4">İlk Masayı Ekle</button>
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
            <p className="font-bold text-xl text-gray-900">Masa {qrTable.number}</p>
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
                onClick={() => handleDownloadQR(qrTable.number)}
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
