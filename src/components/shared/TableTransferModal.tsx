/**
 * Masa Birleştirme / Aktarım Modal
 *
 * Mod "transfer": Kaynak masanın tüm aktif siparişleri hedef masaya taşınır.
 * Mod "merge":    Kaynak masanın tüm aktif siparişleri hedef masanın oturumuna eklenir.
 * Her iki modda da kaynak masa needs_cleaning olur, hedef masa occupied olur.
 */
import { useState } from 'react';
import { ArrowRight, GitMerge, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTableStore } from '../../stores/tableStore';
import type { Table } from '../../types';

interface Props {
  sourceTable: Table;
  onClose: () => void;
}

type Mode = 'transfer' | 'merge';

export default function TableTransferModal({ sourceTable, onClose }: Props) {
  const { tables, updateTableStatus } = useTableStore();
  const [mode, setMode] = useState<Mode>('transfer');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  // Transfer → boş masalar (available + needs_cleaning)
  // Merge → dolu masalar (occupied + needs_cleaning)
  const candidates = tables.filter((t) => {
    if (t.id === sourceTable.id) return false;
    if (mode === 'transfer') return t.status === 'available' || t.status === 'needs_cleaning';
    return t.status === 'occupied' || t.status === 'needs_cleaning';
  });

  const statusLabel = (s: string) => {
    if (s === 'occupied') return 'Dolu';
    if (s === 'needs_cleaning') return 'Temizlik Bekleniyor';
    return 'Boş';
  };

  const handleSubmit = async () => {
    if (!targetId) { toast.error('Lütfen bir hedef masa seçin.'); return; }
    const target = tables.find((t) => t.id === targetId);
    if (!target) return;

    setLoading(true);
    try {
      // Kaynak masanın aktif siparişlerini al
      const snap = await getDocs(query(
        collection(db, 'orders'),
        where('tableId', '==', sourceTable.id),
        where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
      ));

      if (snap.empty) {
        toast.error('Kaynak masada aktif sipariş yok.');
        return;
      }

      // Merge'de hedef masanın mevcut sessionId'si, Transfer'da hedef masanın sessionId (yoksa yenisi)
      const targetSessionId = target.sessionId ?? null;

      // Tüm siparişleri hedef masaya taşı
      await Promise.all(snap.docs.map((d) =>
        updateDoc(doc(db, 'orders', d.id), {
          tableId: target.id,
          tableNumber: target.number,
          sessionId: targetSessionId,
          updatedAt: serverTimestamp(),
        }),
      ));

      // Kaynak masayı needs_cleaning yap (her iki modda)
      await updateTableStatus(sourceTable.id, 'needs_cleaning');

      // Hedef masayı occupied yap
      await updateDoc(doc(db, 'tables', target.id), {
        status: 'occupied',
        updatedAt: serverTimestamp(),
      });

      const actionLabel = mode === 'transfer' ? 'aktarıldı' : 'birleştirildi';
      toast.success(`Masa ${sourceTable.number} → Masa ${target.number} ${actionLabel}.`);
      onClose();
    } catch {
      toast.error('İşlem başarısız. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Masa {sourceTable.number}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mod seçimi */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('transfer'); setTargetId(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
              mode === 'transfer' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            <ArrowRight className="w-4 h-4" /> Aktarım
          </button>
          <button
            onClick={() => { setMode('merge'); setTargetId(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
              mode === 'merge' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            <GitMerge className="w-4 h-4" /> Birleştir
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          {mode === 'transfer'
            ? `Masa ${sourceTable.number}'deki siparişler boş bir masaya taşınır. Kaynak masa temizlemeye alınır.`
            : `Masa ${sourceTable.number}'deki siparişler dolu bir masanın hesabına eklenir. Kaynak masa temizlemeye alınır.`}
        </p>

        {/* Hedef masa */}
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Hedef Masa
        </label>
        {candidates.length === 0 ? (
          <p className="text-sm text-red-500">
            {mode === 'transfer' ? 'Uygun boş masa yok.' : 'Uygun dolu masa yok.'}
          </p>
        ) : (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="input w-full mb-4"
          >
            <option value="">Masa seçin…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                Masa {t.number} — {statusLabel(t.status)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !targetId || candidates.length === 0}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'İşleniyor…' : mode === 'transfer' ? 'Aktarımı Onayla' : 'Birleştirmeyi Onayla'}
        </button>
      </div>
    </div>
  );
}
