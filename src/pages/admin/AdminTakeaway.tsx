import { useEffect, useMemo, useState } from 'react';
import { Package, Phone, User, Search, Trash2, Settings, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrderStore } from '../../stores/orderStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { GelAlSettings } from '../../types';

export default function AdminTakeaway() {
  const { orders, subscribe } = useOrderStore();
  const { settings, subscribe: subscribeSettings, update: updateSettings } = useSettingsStore();
  const [search, setSearch] = useState('');
  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);

  useEffect(() => {
    const u1 = subscribe();
    const u2 = subscribeSettings();
    return () => { u1(); u2(); };
  }, []);

  // Sync local WA number input when settings load
  useEffect(() => {
    setWaNumber(settings.whatsappNumber);
  }, [settings.whatsappNumber]);

  const handleToggle = async (key: keyof Pick<GelAlSettings, 'phoneVerification' | 'whatsappEnabled'>) => {
    try {
      await updateSettings({ [key]: !settings[key] });
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      toast.error(`Ayar değiştirilemedi${code ? ` [${code}]` : ''}.`);
    }
  };

  // waNumber stores E.164: +905520230756 | ''
  // formatPhone produces display: +90 (552) 023 07 56
  const formatPhone = (local: string) => {
    const d = local.slice(0, 10);
    if (d.length === 0) return '+90 ';
    if (d.length <= 3)  return `+90 (${d}`;
    if (d.length <= 6)  return `+90 (${d.slice(0, 3)}) ${d.slice(3)}`;
    if (d.length <= 8)  return `+90 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
    return `+90 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  };

  const localDigits = waNumber.replace(/\D/g, '').replace(/^90/, '').slice(0, 10);
  const phoneDisplay = formatPhone(localDigits);

  const handlePhoneChange = (raw: string) => {
    const allDigits = raw.replace(/\D/g, '');
    // Başında 90 varsa at (ülke kodu zaten sabit)
    let local = allDigits.startsWith('90') ? allDigits.slice(2) : allDigits;
    local = local.slice(0, 10);
    setWaNumber(local ? `+90${local}` : '');
  };

  const handleSaveNumber = async () => {
    const trimmed = waNumber.trim();
    if (!trimmed) return;
    setSavingNumber(true);
    try {
      await updateSettings({ whatsappNumber: trimmed });
      toast.success('WhatsApp numarası kaydedildi.');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      toast.error(`Kaydedilemedi${code ? ` [${code}]` : ''}. Tekrar deneyin.`);
    } finally {
      setSavingNumber(false);
    }
  };

  const customers = useMemo(() => {
    const map = new Map<string, { name?: string; phone: string }>();
    for (const o of orders) {
      if (o.type !== 'takeaway' || !o.customerPhone) continue;
      if (!map.has(o.customerPhone)) {
        map.set(o.customerPhone, { phone: o.customerPhone, name: o.customerName });
      } else if (o.customerName && !map.get(o.customerPhone)!.name) {
        map.get(o.customerPhone)!.name = o.customerName;
      }
    }
    return Array.from(map.values());
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.phone.includes(q) || c.name?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const handleDeleteCustomerData = async (phone: string, name?: string) => {
    const label = name ? `${name} (${phone})` : phone;
    if (!confirm(`"${label}" kişisine ait tüm sipariş kayıtları ve kişisel veriler silinsin mi?\n\nBu işlem geri alınamaz.`)) return;
    setDeletingPhone(phone);
    try {
      const { deleteDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const q = query(
        collection(db, 'orders'),
        where('customerPhone', '==', phone),
        where('type', '==', 'takeaway'),
      );
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'orders', d.id))));
      toast.success(`${snap.size} sipariş kaydı silindi.`);
    } catch {
      toast.error('Silme işlemi başarısız. Tekrar deneyin.');
    } finally {
      setDeletingPhone(null);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">

      {/* ── Sipariş Kanalı Ayarları ── */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-brand-600" />
          <h3 className="font-bold text-gray-900 text-sm">Sipariş Kanalı Ayarları</h3>
        </div>

        {/* SMS Doğrulama */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">SMS Doğrulama</p>
            <p className="text-xs text-gray-500 mt-0.5">Müşterinin telefon numarasını SMS ile doğrula</p>
          </div>
          <button
            onClick={() => handleToggle('phoneVerification')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.phoneVerification ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              settings.phoneVerification ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* WhatsApp Hattı */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp Sipariş Hattı
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Müşteri WhatsApp üzerinden sipariş verebilsin</p>
            </div>
            <button
              onClick={() => handleToggle('whatsappEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.whatsappEnabled ? 'bg-green-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {settings.whatsappEnabled && (
            <>
              <div className="flex gap-2 mt-2">
                <input
                  type="tel"
                  value={phoneDisplay}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="input flex-1 text-sm font-mono tracking-wide"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNumber()}
                />
                <button
                  onClick={handleSaveNumber}
                  disabled={savingNumber || !waNumber.trim()}
                  className="btn-primary px-4 text-sm disabled:opacity-50"
                >
                  {savingNumber ? '…' : 'Kaydet'}
                </button>
              </div>
              {!waNumber && !settings.whatsappNumber && (
                <p className="text-xs text-amber-600 mt-1.5">⚠️ WhatsApp numarası girilmeden sipariş hattı çalışmaz.</p>
              )}
              {settings.whatsappNumber && waNumber === settings.whatsappNumber && (
                <p className="text-xs text-green-700 mt-1.5">✓ Aktif numara: {settings.whatsappNumber}</p>
              )}
              {settings.whatsappNumber && waNumber !== settings.whatsappNumber && waNumber && (
                <p className="text-xs text-gray-400 mt-1.5">Kaydetmek için → Kaydet butonuna basın.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Müşteri / KVKK Silme ── */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya telefon ara..."
            className="input pl-9 w-full"
          />
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} müşteri</span>
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Müşteri bulunamadı</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <div key={c.phone} className="card flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {c.name ?? 'İsimsiz'}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Phone className="w-3 h-3" />
                <span>{c.phone}</span>
              </div>
            </div>
            <button
              onClick={() => handleDeleteCustomerData(c.phone, c.name)}
              disabled={deletingPhone === c.phone}
              title="KVKK silme talebi — tüm verilerini sil"
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              {deletingPhone === c.phone
                ? <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
