import { useEffect, useState } from 'react';
import { Printer, RefreshCw, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePrinterStore } from '../../stores/printerStore';

const KITCHEN_STATIONS = [
  { id: 'station1', label: 'İstasyon 1' },
  { id: 'station2', label: 'İstasyon 2' },
  { id: 'station3', label: 'İstasyon 3' },
];

export default function AdminSettings() {
  const { settings, availablePrinters, subscribe, update, fetchAvailablePrinters } = usePrinterStore();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState('http://localhost:3001');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  useEffect(() => {
    setEnabled(settings.enabled);
    setBridgeUrl(settings.bridgeUrl || 'http://localhost:3001');
    setMapping(settings.stationMapping || {});
  }, [settings]);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      await fetchAvailablePrinters();
      setBridgeStatus('connected');
      toast.success(`${availablePrinters.length} yazıcı bulundu.`);
    } catch (err) {
      setBridgeStatus('error');
      toast.error('Bridge servise bağlanılamadı. Servisin çalıştığından emin olun.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await update({
        enabled,
        bridgeUrl,
        stationMapping: mapping,
      });
      toast.success('Ayarlar kaydedildi.');
    } catch (err) {
      toast.error('Kaydedilemedi: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Yazıcı Ayarları</h1>
        <p className="text-sm text-gray-500">
          Mutfak istasyonlarına yazıcı atayarak siparişlerin otomatik yazdırılmasını sağlayın.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 rounded accent-brand-600"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-900 block">Otomatik Yazdırma</span>
            <span className="text-sm text-gray-500">Yeni siparişler tanımlı yazıcılara otomatik gönderilir.</span>
          </div>
        </label>
      </div>

      {/* Bridge URL */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Bridge Service URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            className="input flex-1"
            placeholder="http://localhost:3001"
          />
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Test
          </button>
        </div>
        {bridgeStatus === 'connected' && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Bridge servise bağlantı başarılı
          </div>
        )}
        {bridgeStatus === 'error' && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            Bridge servise ulaşılamadı. Servisin çalıştığından emin olun.
          </div>
        )}
      </div>

      {/* Station Mapping */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">İstasyon → Yazıcı Eşleştirmesi</h2>
        <div className="flex flex-col gap-3">
          {KITCHEN_STATIONS.map((station) => (
            <div key={station.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{station.label}</label>
              <select
                value={mapping[station.id] || ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [station.id]: e.target.value }))}
                className="input"
              >
                <option value="">Yazıcı seçilmedi</option>
                {availablePrinters.map((printer) => (
                  <option key={printer} value={printer}>
                    {printer}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {availablePrinters.length === 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p>Yazıcı listesi boş. "Test" butonuna basarak bridge servisten yazıcıları yükleyin.</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <div className="flex gap-3">
          <Printer className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Nasıl Çalışır?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Kasa PC'sinde bridge service çalışmalı</li>
              <li>Kategorilere istasyon atayın (Ürünler sayfasında)</li>
              <li>Her istasyona bir yazıcı tanımlayın</li>
              <li>Sipariş geldiğinde ürünler istasyonlara göre gruplandırılır ve otomatik yazdırılır</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {loading ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
      </button>
    </div>
  );
}
