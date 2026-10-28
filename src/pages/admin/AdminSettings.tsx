import { useEffect, useState } from 'react';
import { Printer, RefreshCw, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
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

  useEffect(() => subscribe(), [subscribe]);

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
      const message = error instanceof Error ? error.message : 'Bridge servise bağlanılamadı.';
      setBridgeChecks((previous) => ({
        ...previous,
        [stationId]: { status: 'error', message },
      }));
      toast.error(message);
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
    </div>
  );
}
