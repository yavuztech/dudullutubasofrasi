import { useState } from 'react';
import { X, Printer, Flame, Cookie, Sandwich } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrderStore } from '../../stores/orderStore';

interface Props {
  onClose: () => void;
}

const STATIONS = [
  { id: 'all', label: 'Tüm Mutfak İstasyonları', icon: Printer, desc: 'Fırın, Izgara, Burger ve Tatlı yazıcılarına birer test fişi gönderir.' },
  { id: 'station1', label: 'Fırın (station1)', icon: Flame, desc: 'Fırın termal yazıcısına test fişi gönderir.' },
  { id: 'station2', label: 'Izgara (station2)', icon: Flame, desc: 'Izgara termal yazıcısına test fişi gönderir.' },
  { id: 'station4', label: 'Burger (station4)', icon: Sandwich, desc: 'Burger termal yazıcısına test fişi gönderir.' },
  { id: 'station5', label: 'Tatlı (station5)', icon: Cookie, desc: 'Tatlı termal yazıcısına test fişi gönderir.' },
];

export default function PrinterTestModal({ onClose }: Props) {
  const { createOrder } = useOrderStore();
  const [selectedStation, setSelectedStation] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSendTestPrint = async () => {
    setLoading(true);
    try {
      const items = [];
      if (selectedStation === 'all' || selectedStation === 'station1') {
        items.push({
          productId: 'test-item-station1',
          productName: 'TEST - Fırın Pide',
          quantity: 1,
          unitPrice: 0,
          kitchenStation: 'station1',
          notes: '*** YAZICI TESTİ ***',
        });
      }
      if (selectedStation === 'all' || selectedStation === 'station2') {
        items.push({
          productId: 'test-item-station2',
          productName: 'TEST - Izgara Kebap',
          quantity: 1,
          unitPrice: 0,
          kitchenStation: 'station2',
          notes: '*** YAZICI TESTİ ***',
        });
      }
      if (selectedStation === 'all' || selectedStation === 'station4') {
        items.push({
          productId: 'test-item-station4',
          productName: 'TEST - Burger',
          quantity: 1,
          unitPrice: 0,
          kitchenStation: 'station4',
          notes: '*** YAZICI TESTİ ***',
        });
      }
      if (selectedStation === 'all' || selectedStation === 'station5') {
        items.push({
          productId: 'test-item-station5',
          productName: 'TEST - Tatlı Künefe',
          quantity: 1,
          unitPrice: 0,
          kitchenStation: 'station5',
          notes: '*** YAZICI TESTİ ***',
        });
      }

      await createOrder({
        type: 'table',
        tableNumber: 0,
        tableLabel: 'YAZICI TESTİ',
        isTestOrder: true,
        items,
        status: 'pending',
        totalAmount: 0,
        notes: '*** GARSON YAZICI TESTİ ***',
      });

      toast.success('Test fişi mutfak yazıcısına gönderildi!');
      onClose();
    } catch (error) {
      console.error('Test fişi gönderilemedi:', error);
      toast.error('Test fişi gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Yazıcı Testi Gönder</h3>
              <p className="text-xs text-gray-500">Masaya sipariş girmeden yazıcıyı test edin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {STATIONS.map((st) => {
            const Icon = st.icon;
            const active = selectedStation === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setSelectedStation(st.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-sm'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{st.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{st.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">
            Vazgeç
          </button>
          <button
            onClick={handleSendTestPrint}
            disabled={loading}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {loading ? 'Gönderiliyor…' : 'Test Fişi Bas'}
          </button>
        </div>
      </div>
    </div>
  );
}
