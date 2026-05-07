/**
 * Masa Birleştirme / Aktarım Modal
 *
 * Mod "transfer":  Kaynak masanın tüm aktif siparişleri hedef BOŞMASAYA taşınır.
 * Mod "join":      Boş bir masa fiziksel olarak kaynağa eklenir → "Masa 1 - 2" görünümü.
 *                  Siparişler taşınmaz; sadece UI'da birleşik gösterilir.
 * Mod "merge":     Kaynak masanın siparişleri dolu hedef masanın hesabına eklenir.
 */
import { useState } from 'react';
import { ArrowRight, Link2, GitMerge, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTableStore } from '../../stores/tableStore';
import { getTableDisplayName, getMergedTableDisplayName } from '../../utils/tableUtils';
import type { Table } from '../../types';

interface Props {
  sourceTable: Table;
  onClose: () => void;
}

type Mode = 'transfer' | 'join' | 'merge';

export default function TableTransferModal({ sourceTable, onClose }: Props) {
  const { tables } = useTableStore();
  const [mode, setMode] = useState<Mode>('join');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  const statusLabel = (t: Table) => {
    if (t.status === 'occupied') {
      const nums = [t.number, ...(t.mergedTableNumbers ?? [])];
      const displayName = nums.length > 1 
        ? getMergedTableDisplayName(nums, t.section)
        : getTableDisplayName(t);
      return `Dolu — ${displayName}`;
    }
    if (t.status === 'needs_cleaning') return 'Temizlik Bekleniyor';
    return 'Boş';
  };

  // Kaynak masa ile aynı bölümdeki masaları filtrele
  const sourceSection = sourceTable.section ?? 'normal';
  
  const candidates = tables.filter((t) => {
    if (t.id === sourceTable.id) return false;
    if (t.mergedIntoId) return false; // zaten başka masaya eklenmiş
    
    // Sadece aynı section'daki masalar
    const targetSection = t.section ?? 'normal';
    if (sourceSection !== targetSection) return false;
    
    if (mode === 'transfer') return t.status === 'available' || t.status === 'needs_cleaning';
    if (mode === 'join')     return t.status === 'available' || t.status === 'needs_cleaning';
    // merge → dolu masalar
    return t.status === 'occupied' || t.status === 'needs_cleaning';
  });

  const descriptions: Record<Mode, string> = {
    transfer: `${getTableDisplayName(sourceTable)}'deki siparişler seçilen boş masaya taşınır. Kaynak masa temizlemeye alınır.`,
    join:     `Seçilen boş masa fiziksel olarak ${getTableDisplayName(sourceTable)}'e eklenir. Siparişler aynı hesapta toplanır.`,
    merge:    `${getTableDisplayName(sourceTable)}'deki siparişler seçilen dolu masanın hesabına eklenir. Kaynak masa temizlemeye alınır.`,
  };

  const handleSubmit = async () => {
    if (!targetId) { toast.error('Lütfen bir hedef masa seçin.'); return; }
    const target = tables.find((t) => t.id === targetId);
    if (!target) return;

    setLoading(true);
    try {
      if (mode === 'join') {
        // Fiziksel birleştirme: hedef boş masayı kaynağa ekle
        // Hedef masayı occupied + mergedIntoId işaretle
        await updateDoc(doc(db, 'tables', target.id), {
          status: 'occupied',
          mergedIntoId: sourceTable.id,
          updatedAt: serverTimestamp(),
        });
        // Kaynak masaya hedef masayı ekle
        await updateDoc(doc(db, 'tables', sourceTable.id), {
          mergedTableIds: arrayUnion(target.id),
          mergedTableNumbers: arrayUnion(target.number),
          updatedAt: serverTimestamp(),
        });
        toast.success(`${getTableDisplayName(target)}, ${getTableDisplayName(sourceTable)}'e eklendi.`);
        onClose();
        return;
      }

      // Transfer ve Merge: siparişleri taşı
      const snap = await getDocs(query(
        collection(db, 'orders'),
        where('tableId', '==', sourceTable.id),
        where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']),
      ));

      if (snap.empty) {
        toast.error('Kaynak masada aktif sipariş yok.');
        return;
      }

      const targetSessionId = target.sessionId ?? null;
      await Promise.all(snap.docs.map((d) =>
        updateDoc(doc(db, 'orders', d.id), {
          tableId: target.id,
          tableNumber: target.number,
          sessionId: targetSessionId,
          updatedAt: serverTimestamp(),
        }),
      ));

      // Kaynak masayı temizlemeye al, merge alanlarını sıfırla
      await updateDoc(doc(db, 'tables', sourceTable.id), {
        status: 'needs_cleaning',
        mergedTableIds: [],
        mergedTableNumbers: [],
        updatedAt: serverTimestamp(),
      });
      // Kaynak masaya bağlı diğer masaları da sıfırla
      if (sourceTable.mergedTableIds?.length) {
        await Promise.all(sourceTable.mergedTableIds.map((id) =>
          updateDoc(doc(db, 'tables', id), {
            status: 'needs_cleaning',
            mergedIntoId: null,
            updatedAt: serverTimestamp(),
          }),
        ));
      }

      await updateDoc(doc(db, 'tables', target.id), {
        status: 'occupied',
        updatedAt: serverTimestamp(),
      });

      const label = mode === 'transfer' ? 'aktarıldı' : 'birleştirildi';
      toast.success(`${getTableDisplayName(sourceTable)} → ${getTableDisplayName(target)} ${label}.`);
      onClose();
    } catch {
      toast.error('İşlem başarısız. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const btnClass = (m: Mode) =>
    `flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
      mode === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{getTableDisplayName(sourceTable)}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mod seçimi */}
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => { setMode('transfer'); setTargetId(''); }} className={btnClass('transfer')}>
            <ArrowRight className="w-3.5 h-3.5" /> Aktarım
          </button>
          <button onClick={() => { setMode('join'); setTargetId(''); }} className={btnClass('join')}>
            <Link2 className="w-3.5 h-3.5" /> Masa Ekle
          </button>
          <button onClick={() => { setMode('merge'); setTargetId(''); }} className={btnClass('merge')}>
            <GitMerge className="w-3.5 h-3.5" /> Hesap Birleştir
          </button>
        </div>

        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-4 leading-relaxed">
          {descriptions[mode]}
        </p>

        {/* Hedef masa */}
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {mode === 'join' ? 'Eklenecek Boş Masa' : 'Hedef Masa'}
        </label>
        {candidates.length === 0 ? (
          <p className="text-sm text-red-500 mb-4">
            {mode === 'merge' 
              ? `${sourceSection === 'family' ? 'Aile bölümünde' : 'Normal masalarda'} uygun dolu masa yok.` 
              : `${sourceSection === 'family' ? 'Aile bölümünde' : 'Normal masalarda'} uygun boş masa yok.`}
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
                {getTableDisplayName(t)} — {statusLabel(t)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !targetId || candidates.length === 0}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'İşleniyor…' : mode === 'transfer' ? 'Aktarımı Onayla' : mode === 'join' ? 'Masayı Ekle' : 'Hesapları Birleştir'}
        </button>
      </div>
    </div>
  );
}
