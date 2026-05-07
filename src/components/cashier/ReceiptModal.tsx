import { useRef, useState } from 'react';
import { X, Printer, List } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Order, OrderItem } from '../../types';

interface Props {
  tableNumber?: number;
  tableLabel?: string; // birleşik masalar için "Masa 1 - 2"
  customerName?: string;
  customerPhone?: string;
  orders: Order[];
  discountRate?: number;
  discountApplied?: boolean;
  onClose: () => void;
}

type PrintMode = 'order' | 'item';

export default function ReceiptModal({ tableNumber, tableLabel, customerName, customerPhone, orders, discountRate = 0, discountApplied = false, onClose }: Props) {
  const [mode, setMode] = useState<PrintMode>('item');
  const printRef = useRef<HTMLDivElement>(null);

  // --- Ürün bazlı özet ---
  const productSummary = (() => {
    const map = new Map<string, OrderItem & { subtotal: number }>();
    for (const o of orders) {
      for (const item of o.items) {
        const key = item.productId;
        if (map.has(key)) {
          const ex = map.get(key)!;
          ex.quantity += item.quantity;
          ex.subtotal += item.unitPrice * item.quantity;
        } else {
          map.set(key, { ...item, subtotal: item.unitPrice * item.quantity });
        }
      }
    }
    return Array.from(map.values());
  })();

  const rawTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
  const discountAmount = discountApplied && discountRate > 0 ? Math.round(rawTotal * discountRate / 100) : 0;
  const finalTotal = rawTotal - discountAmount;
  const now = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    let content: string;
    if (mode === 'item') {
      const pages = productSummary.map((item, idx) => {
        const cls = idx < productSummary.length - 1 ? 'slip page-break' : 'slip';
        let loc = '';
        if (tableNumber) {
          loc = `<p class="sub">${tableLabel ?? `Masa ${tableNumber}`}</p>`;
        } else if (customerName) {
          loc = `<p class="sub">Gel Al \u2014 ${customerName}</p>`;
          if (customerPhone) loc += `<p class="sub">${customerPhone}</p>`;
        }
        return `<div class="${cls}"><h2>Tuba Sofras\u0131</h2>${loc}<p class="sub">${now}</p><div class="divider"></div><div class="row"><span class="name">${item.productName} \u00d7${item.quantity}</span><span class="amount">${formatCurrency(item.subtotal)}</span></div><div class="divider"></div><p class="footer">Te\u015fekkür ederiz</p></div>`;
      });
      content = pages.join('');
    } else {
      content = printRef.current?.innerHTML ?? '';
    }
    if (!content) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8" />
        <title>Fiş</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
          h2 { text-align: center; font-size: 14px; margin-bottom: 4px; }
          .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .row .name { flex: 1; }
          .row .amount { flex-shrink: 0; text-align: right; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border-top: 1px solid #000; margin-top: 6px; padding-top: 4px; }
          .discount { color: #c00; font-size: 11px; }
          .footer { text-align: center; font-size: 10px; margin-top: 10px; color: #555; }
          .slip.page-break { page-break-after: always; padding-bottom: 20px; }
          .order-header { font-size: 11px; color: #555; border-bottom: 1px dashed #ccc; padding-bottom: 2px; margin-bottom: 4px; }
        </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
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

        {/* Önizleme */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {mode === 'item' ? (
            <div className="flex flex-col gap-3 font-mono text-xs">
              {productSummary.map((item, i) => (
                <div key={item.productId} className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
                  <p className="text-[10px] text-gray-400 text-center mb-1">{i + 1} / {productSummary.length}</p>
                  <h2 className="text-center font-bold text-sm mb-0.5">Tuba Sofrası</h2>
                  {tableNumber && <p className="text-center text-gray-500 text-[11px] mb-0.5">{tableLabel ?? `Masa ${tableNumber}`}</p>}
                  {!tableNumber && customerName && <p className="text-center text-gray-500 text-[11px] mb-0.5">Gel Al — {customerName}</p>}
                  <p className="text-center text-gray-400 text-[10px] mb-1.5">{now}</p>
                  <div className="border-t border-dashed border-gray-300 my-1.5" />
                  <div className="flex justify-between py-0.5">
                    <span>{item.productName} ×{item.quantity}</span>
                    <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-1.5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs" ref={printRef}>
              <h2 className="text-center font-bold text-sm mb-0.5">Tuba Sofrası</h2>
              {tableNumber && <p className="sub text-center text-gray-500 mb-1">{tableLabel ?? `Masa ${tableNumber}`}</p>}
              {!tableNumber && customerName && <p className="sub text-center text-gray-500 mb-0.5">Gel Al — {customerName}</p>}
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
          <button onClick={handlePrint} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Printer className="w-5 h-5" />
            Yazdır
          </button>
        </div>

      </div>
    </div>
  );
}
