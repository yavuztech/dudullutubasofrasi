import { useEffect, useState } from 'react';
import { X, Printer, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import type { Order, OrderItem } from '../../types';
import { usePrinterStore } from '../../stores/printerStore';

interface Props {
  tableNumber?: number;
  tableLabel?: string; // birleşik masalar için "Masa 1 - 2"
  customerName?: string;
  customerPhone?: string;
  orders: Order[];
  discountRate?: number;
  discountApplied?: boolean;
  onClose: () => void;
  onPrinted?: () => void;
}

type PrintMode = 'order' | 'item';
type CashierReceiptPayload =
  | {
      mode: 'item';
      location: string;
      customerName?: string;
      customerPhone?: string;
      printedAt: string;
      items: Array<{ productName: string; quantity: number }>;
    }
  | {
      mode: 'order';
      location: string;
      customerName?: string;
      customerPhone?: string;
      printedAt: string;
      orders: Array<{
        createdAt: string;
        items: Array<{ productName: string; quantity: number; unitPrice: number }>;
      }>;
      rawTotal: number;
      discountApplied: boolean;
      discountRate: number;
      discountAmount: number;
      finalTotal: number;
    };

export default function ReceiptModal({ tableNumber, tableLabel, customerName, customerPhone, orders, discountRate = 0, discountApplied = false, onClose, onPrinted }: Props) {
  const [mode, setMode] = useState<PrintMode>('item');
  const [printing, setPrinting] = useState(false);
  const [receiptCustomerName, setReceiptCustomerName] = useState(customerName ?? '');
  const { settings, subscribe } = usePrinterStore();

  useEffect(() => subscribe(), [subscribe]);

  // --- Ürün bazlı özet ---
  const productSummary = (() => {
    const map = new Map<string, OrderItem>();
    for (const o of orders) {
      for (const item of o.items) {
        const key = item.productId;
        const existingItem = map.get(key);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          map.set(key, { ...item });
        }
      }
    }
    return Array.from(map.values());
  })();

  const rawTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
  const discountAmount = discountApplied && discountRate > 0 ? Math.round(rawTotal * discountRate / 100) : 0;
  const finalTotal = rawTotal - discountAmount;
  const now = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handlePrint = async () => {
    const location = tableNumber
      ? tableLabel ?? `Masa ${tableNumber}`
      : customerName
        ? 'Gel Al'
        : '';
    const printedAt = now;
    const receiptHeader = {
      location,
      ...(receiptCustomerName.trim() ? { customerName: receiptCustomerName.trim() } : {}),
      ...(!tableNumber && customerPhone ? { customerPhone } : {}),
      printedAt,
    };
    let receipts: CashierReceiptPayload[];

    if (mode === 'item') {
      receipts = productSummary.map((item) => ({
        ...receiptHeader,
        mode: 'item',
        items: [{
          productName: item.productName,
          quantity: item.quantity,
        }],
      }));
    } else {
      receipts = [{
        ...receiptHeader,
        mode: 'order',
        orders: orders.map((order) => ({
          createdAt: order.createdAt.toISOString(),
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        })),
        rawTotal,
        discountApplied,
        discountRate,
        discountAmount,
        finalTotal,
      }];
    }

    if (receipts.length === 0) {
      toast.error('Yazdırılacak fiş bulunamadı.');
      return;
    }

    const cashierBridgeUrl = settings.bridgeUrls
      ? settings.bridgeUrls.station3
      : settings.bridgeUrl || 'http://localhost:3001';
    if (!cashierBridgeUrl?.trim()) {
      toast.error('Kasa Bridge adresi Yazıcı Ayarları bölümünde tanımlanmamış.');
      return;
    }

    setPrinting(true);
    try {
      const bridgeUrl = cashierBridgeUrl.replace(/\/+$/, '');
      const response = await fetch(`${bridgeUrl}/print/cashier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts }),
      });
      const result: { error?: string; printed?: number; printer?: string } = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Kasa yazıcısına fiş gönderilemedi.');
      }
      toast.success(`${result.printed ?? receipts.length} fiş ${result.printer} yazıcısına gönderildi.`);
      onPrinted?.();
    } catch (error) {
      console.error('Kasa fişi yazdırılamadı:', error);
      let msg = error instanceof Error ? error.message : 'Kasa fişi yazdırılamadı.';
      if (window.location.protocol === 'https:' && cashierBridgeUrl.startsWith('http://')) {
        msg = 'Tarayıcı HTTPS sayfasından yerel HTTP servisine (http://localhost:3001) doğrudan erişimi engelledi. Kasa bilgisayarında tarayıcı adres çubuğundaki kilit ikonundan "Güvensiz içerik" izni verebilirsiniz.';
      }
      toast.error(msg, { duration: 6000 });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-in flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-brand-600" />
            <h3 className="font-bold text-gray-900">Fiş Yazdır</h3>
            {tableNumber && <span className="text-xs text-gray-500">• {tableLabel ?? `Masa ${tableNumber}`}</span>}
            {!tableNumber && customerName && <span className="text-xs text-gray-500">• {customerName}</span>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mod seçimi */}
        <div className="flex gap-1.5 p-4 pb-2 flex-shrink-0">
          <button
            onClick={() => setMode('order')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${mode === 'order' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
          >
            <List className="w-3.5 h-3.5" /> Sipariş Bazlı
          </button>
          <button
            onClick={() => setMode('item')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${mode === 'item' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
          >
            <Printer className="w-3.5 h-3.5" /> Ürün Başına
          </button>
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <label htmlFor="receipt-customer-name" className="block text-xs font-medium text-gray-600 mb-1">
            Ad Soyad <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          </label>
          <input
            id="receipt-customer-name"
            type="text"
            maxLength={100}
            value={receiptCustomerName}
            onChange={(event) => setReceiptCustomerName(event.target.value)}
            className="input w-full py-2 text-sm"
            placeholder="Fişte görünecek ad soyad"
          />
        </div>

        {/* Önizleme */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {mode === 'item' ? (
            <div className="flex flex-col gap-3 font-mono text-xs">
              {productSummary.map((item, i) => (
                <div key={item.productId} className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
                  <p className="text-[10px] text-gray-400 text-center mb-1">{i + 1} / {productSummary.length}</p>
                  <h2 className="text-center font-bold text-sm mb-0.5">Tuba Sofrası</h2>
                  {tableNumber && <p className="text-center text-gray-500 text-[11px] mb-0.5">{tableLabel ?? `Masa ${tableNumber}`}</p>}
                  {!tableNumber && customerName && <p className="text-center text-gray-500 text-[11px] mb-0.5">Gel Al</p>}
                  {receiptCustomerName.trim() && <p className="text-center text-gray-500 text-[11px] mb-0.5">{receiptCustomerName.trim()}</p>}
                  <p className="text-center text-gray-400 text-[10px] mb-1.5">{now}</p>
                  <div className="border-t border-dashed border-gray-300 my-1.5" />
                  <p className="py-0.5">{item.productName} ×{item.quantity}</p>
                  <div className="border-t border-dashed border-gray-300 my-1.5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs">
              <h2 className="text-center font-bold text-sm mb-0.5">Tuba Sofrası</h2>
              {tableNumber && <p className="sub text-center text-gray-500 mb-1">{tableLabel ?? `Masa ${tableNumber}`}</p>}
              {!tableNumber && customerName && <p className="sub text-center text-gray-500 mb-0.5">Gel Al</p>}
              {receiptCustomerName.trim() && <p className="sub text-center text-gray-500 mb-0.5">{receiptCustomerName.trim()}</p>}
              {!tableNumber && customerPhone && <p className="sub text-center text-gray-400 mb-1">{customerPhone}</p>}
              <p className="text-center text-gray-400 text-[11px] mb-2">{now}</p>
              <div className="divider border-t border-dashed border-gray-300 my-2" />

              {orders.map((order, i) => (
                  <div key={order.id} className="mb-2">
                    <p className="text-gray-400 text-[11px] mb-0.5">
                      Adisyon No: {i + 1} — {order.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {order.items.map((item, j) => (
                      <div key={j} className="row flex justify-between py-0.5">
                        <span className="name">{item.productName} ×{item.quantity}</span>
                        <span className="amount">{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              
              <div className="divider border-t border-dashed border-gray-300 my-2" />

              {discountApplied && discountAmount > 0 && (
                <>
                  <div className="row flex justify-between py-0.5 text-gray-500">
                    <span>Ara Toplam</span>
                    <span>{formatCurrency(rawTotal)}</span>
                  </div>
                  <div className="row flex justify-between py-0.5 text-red-600 discount">
                    <span>Personel İndirimi (%{discountRate})</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="total-row flex justify-between font-bold text-sm border-t border-gray-400 mt-1 pt-1">
                <span>TOPLAM</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>

              <p className="footer text-center text-gray-400 text-[10px] mt-3">Teşekkür ederiz 🙏</p>
            </div>
          )}
        </div>

        {/* Print button */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={handlePrint} disabled={printing} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            <Printer className="w-5 h-5" />
            {printing ? 'Yazdırılıyor…' : 'Kasa Yazıcısında Yazdır'}
          </button>
        </div>

      </div>
    </div>
  );
}
