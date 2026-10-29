import { useEffect, useState } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Printer, RefreshCw, RotateCcw, Save, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../../lib/firebase';
import { usePrinterStore } from '../../stores/printerStore';

const KITCHEN_STATIONS = [
  { id: 'station1', label: 'Fırın' },
  { id: 'station2', label: 'Izgara' },
  { id: 'station3', label: 'Kasa' },
  { id: 'station4', label: 'Burger' },
];

type BridgeCheck = {
  status: 'connected' | 'error';
  message: string;
};

export default function AdminSettings() {
  const { settings, subscribe, update, fetchAvailablePrinters } = usePrinterStore();
  const [saving, setSaving] = useState(false);
  const [testingStation, setTestingStation] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [bridgeUrls, setBridgeUrls] = useState<Record<string, string>>({});
  const [bridgeChecks, setBridgeChecks] = useState<Record<string, BridgeCheck>>({});
  const [lastReceiptNumber, setLastReceiptNumber] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingCounter, setResettingCounter] = useState(false);

  useEffect(() => subscribe(), [subscribe]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'counters', 'receipt-sequence'),
      (snapshot) => {
        const lastNumber: unknown = snapshot.data()?.lastNumber ?? 0;
        if (typeof lastNumber !== 'number' || !Number.isInteger(lastNumber) || lastNumber < 0) {
          toast.error('Fiş numarası sayacı geçersiz.');
          return;
        }
        setLastReceiptNumber(lastNumber);
      },
      (error) => {
        console.error('Fiş numarası sayacı okunamadı:', error);
        toast.error('Fiş numarası sayacı okunamadı. Admin yetkinizi kontrol edin.');
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    setEnabled(settings.enabled);
    setBridgeUrls(Object.fromEntries(KITCHEN_STATIONS.map(({ id }) => [
      id,
      settings.bridgeUrls?.[id] ?? (
        settings.bridgeUrls ? '' : settings.bridgeUrl || 'http://localhost:3001'
      ),
    ])));
  }, [settings]);

  const handleTestConnection = async (stationId: string) => {
    const bridgeUrl = bridgeUrls[stationId]?.trim().replace(/\/+$/, '');
    if (!bridgeUrl) {
      toast.error('Önce bu istasyonun Bridge adresini girin.');
      return;
    }

    setTestingStation(stationId);
    setBridgeChecks((previous) => {
      const next = { ...previous };
      delete next[stationId];
      return next;
    });

    try {
      const [healthResponse, printers] = await Promise.all([
        fetch(`${bridgeUrl}/`),
        fetchAvailablePrinters(bridgeUrl),
      ]);
      if (!healthResponse.ok) throw new Error('Bridge servise ulaşılamadı.');
      const health: { station?: unknown; printer?: unknown } = await healthResponse.json();
      if (health.station !== stationId) {
        throw new Error('Bu bilgisayardaki Bridge yanlış istasyona ayarlı. BRIDGE_STATION değerini kontrol edin.');
      }
      if (typeof health.printer !== 'string' || !printers.includes(health.printer)) {
        throw new Error('Bridge’in PRINTER_NAME yazıcısı bu bilgisayarda görünmüyor. Yerel yazıcı kuyruğunu ve USB bağlantısını kontrol edin.');
      }

      const message = `Bağlandı. İstasyon yazıcısı: ${health.printer}. Yerel yazıcılar: ${printers.join(', ')}`;
      setBridgeChecks((previous) => ({
        ...previous,
        [stationId]: { status: 'connected', message },
      }));
      toast.success(`${KITCHEN_STATIONS.find((station) => station.id === stationId)?.label} Bridge bağlantısı başarılı.`);
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Bridge servise bağlanılamadı.';
      if (window.location.protocol === 'https:' && bridgeUrl.startsWith('http://')) {
        message = 'Tarayıcınız HTTPS (canlı site) üzerinden yerel HTTP servisine (http://localhost:3001) doğrudan erişimi engelliyor (Mixed Content). Ayarları kaydedebilirsiniz; Bridge servisi Firestore üzerinden arka planda otomatik çalışmaya devam eder.';
      }
      setBridgeChecks((previous) => ({
        ...previous,
        [stationId]: { status: 'error', message },
      }));
      toast.error(message, { duration: 6000 });
    } finally {
      setTestingStation(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({
        enabled,
        bridgeUrls: Object.fromEntries(KITCHEN_STATIONS.map(({ id }) => [
          id,
          bridgeUrls[id]?.trim().replace(/\/+$/, '') || '',
        ])),
      });
      toast.success('Ayarlar kaydedildi.');
    } catch (error) {
      toast.error(`Kaydedilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetReceiptNumber = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      toast.error('Oturum bulunamadı. Tekrar giriş yapın.');
      return;
    }

    setResettingCounter(true);
    try {
      const counterRef = doc(db, 'counters', 'receipt-sequence');
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(counterRef);
        const currentLastNumber: unknown = snapshot.data()?.lastNumber ?? 0;
        if (
          typeof currentLastNumber !== 'number'
          || !Number.isInteger(currentLastNumber)
          || currentLastNumber < 0
        ) {
          throw new Error('Fiş numarası sayacı geçersiz; sıfırlama yapılamadı.');
        }
        transaction.set(counterRef, {
          lastNumber: 0,
          resetAt: serverTimestamp(),
          resetBy: userId,
        }, { merge: true });
      });
      toast.success('Fiş numarası sıfırlandı. Sonraki fiş 00001 olacak.');
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Fiş numarası sıfırlanamadı:', error);
      toast.error(`Fiş numarası sıfırlanamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setResettingCounter(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Yazıcı Ayarları</h1>
        <p className="text-sm text-gray-500">
          Her istasyonun yazıcısı farklı bilgisayara bağlıysa o bilgisayardaki Bridge adresini girin.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="w-5 h-5 rounded accent-brand-600"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-900 block">Otomatik Yazdırma</span>
            <span className="text-sm text-gray-500">Yeni siparişler ilgili istasyonun Bridge servisine gönderilir.</span>
          </div>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">İstasyon → Bridge Bilgisayarı</h2>
        <div className="flex flex-col gap-5">
          {KITCHEN_STATIONS.map((station) => {
            const check = bridgeChecks[station.id];
            const isTesting = testingStation === station.id;
            return (
              <div key={station.id}>
                <label htmlFor={`bridge-${station.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  {station.label}
                </label>
                <div className="flex gap-2">
                  <input
                    id={`bridge-${station.id}`}
                    type="url"
                    value={bridgeUrls[station.id] ?? ''}
                    onChange={(event) => setBridgeUrls((previous) => ({
                      ...previous,
                      [station.id]: event.target.value,
                    }))}
                    className="input flex-1"
                    placeholder="http://192.168.1.50:3001"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestConnection(station.id)}
                    disabled={saving || testingStation !== null}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Bu bilgisayardaki Bridge için `.env` içinde `BRIDGE_STATION={station.id}` ve yerel CUPS yazıcı adı `PRINTER_NAME` olarak ayarlanmalı.
                </p>
                {check && (
                  <div className={`flex items-start gap-2 mt-2 text-sm ${check.status === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                    {check.status === 'connected'
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                    <span>{check.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <div className="flex gap-3">
          <Printer className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Her bilgisayarda bir kez yapılandırın</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Bridge çalıştırılan bilgisayarda yazıcıyı ekleyip kuyruk adını `lpstat -p` ile bulun.</li>
              <li>`bridge-service/.env` içinde o bilgisayar için `BRIDGE_STATION` ve `PRINTER_NAME` ayarlayın.</li>
              <li>Bilgisayarın yerel IP adresi ve `:3001` portunu ilgili istasyon alanına yazın.</li>
              <li>Bu bilgisayarlar aynı Firestore projesine bağlanır; her bridge yalnızca kendi istasyonunu yazdırır.</li>
              <li>Kategorileri Ürünler sayfasında Fırın, Izgara veya Burger istasyonuna atayın.</li>
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || testingStation !== null}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
      </button>

      <section className="bg-white rounded-2xl border border-gray-200 p-4 mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Fiş Numarası</h2>
            <p className="text-sm text-gray-500 mt-1">
              Son kullanılan numara: <strong>{lastReceiptNumber === null ? 'Yükleniyor…' : String(lastReceiptNumber).padStart(5, '0')}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">Sıfırlama sonrası sıradaki fiş 00001 numarasını alır.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={lastReceiptNumber === null || resettingCounter}
            className="btn-secondary flex items-center gap-2 text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Sıfırla
          </button>
        </div>
      </section>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !resettingCounter && setShowResetConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Fiş numarası sıfırlansın mı?</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Sayaç sıfırlanacak ve sonraki fiş <strong>00001</strong> numarasıyla başlayacak.
                  Bu işlem önceki numaraların yeniden kullanılmasına neden olabilir.
                </p>
                <p className="text-sm text-red-700 font-medium mt-2">
                  Yazıcılar fiş basarken sıfırlamayın; aynı numaranın tekrar verilmesini önlemek için yazdırmanın durduğundan emin olun.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resettingCounter}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void handleResetReceiptNumber()}
                disabled={resettingCounter}
                className="btn-danger flex-1 disabled:opacity-50"
              >
                {resettingCounter ? 'Sıfırlanıyor…' : 'Evet, sıfırla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
