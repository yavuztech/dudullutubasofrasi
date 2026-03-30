import { useEffect, useMemo, useState } from 'react';
import { Package, Phone, User, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrderStore } from '../../stores/orderStore';

export default function AdminTakeaway() {
  const { orders, subscribe } = useOrderStore();
  const [search, setSearch] = useState('');
  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

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
