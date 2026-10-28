const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCashierReceipt, formatKitchenReceipt, isValidCashierReceipt } = require('./receiptFormatter');
const { groupItemsByStation, getUnacknowledgedStations } = require('./kitchenRouting');
const { reserveReceiptNumbers } = require('./receiptNumber');

test('formats a cashier order receipt with Turkish text and aligned totals', () => {
  const receipt = {
    mode: 'order',
    receiptNumber: '00001',
    location: 'Masa 3',
    customerName: 'Ayşe Yılmaz',
    printedAt: '27.10.2026 19:54',
    orders: [{
      createdAt: '2026-10-27T15:51:00.000Z',
      items: [
        { productName: 'DÖNER 100 GR', quantity: 1, unitPrice: 400 },
        { productName: 'DÖNER 1,5 PORSİYON', quantity: 2, unitPrice: 650 },
      ],
    }],
    rawTotal: 1700,
    discountApplied: false,
    discountRate: 0,
    discountAmount: 0,
    finalTotal: 1700,
  };

  assert.equal(isValidCashierReceipt(receipt), true);

  const output = formatCashierReceipt(receipt);
  const decoded = output.toString('ascii');

  assert.match(decoded, /TUBA SOFRASI/);
  assert.match(decoded, /FIS NO: 00001/);
  assert.match(decoded, /Ayse Yilmaz/);
  assert.match(decoded, /DONER 1,5 PORSIYON/);
  assert.match(decoded, /Tesekkur ederiz/);
  assert.match(decoded, /TOPLAM/);
  assert.match(decoded, /1\.700,00 TL/);
  assert.equal(decoded.startsWith('\x1B@\x1B2'), true);
  assert.equal([...output].every((byte) => byte < 128), true);
  assert.equal(decoded.endsWith('\x1DV\x42\x00\x1B@'), true);
});

test('formats kitchen product slips with individual ticket numbers and Turkish text', () => {
  const output = formatKitchenReceipt({
    order: { id: 'order123456', tableNumber: 3 },
    item: { productName: 'İÇLİ KÖFTE', quantity: 2, notes: 'İyi pişsin' },
    station: 'station1',
    receiptNumber: '00002',
  });
  const decoded = output.toString('ascii');

  assert.match(decoded, /FIS NO: 00002/);
  assert.match(decoded, /ICLI KOFTE/);
  assert.match(decoded, /Iyi pissin/);
  assert.match(decoded, /FIRIN/);
  assert.doesNotMatch(decoded, /TL|400,00|650,00/);
  assert.equal(decoded.startsWith('\x1B@\x1B2'), true);
  assert.equal(decoded.endsWith('\x1DV\x42\x00\x1B@'), true);
});

test('labels burger station kitchen slips as BURGER', () => {
  const output = formatKitchenReceipt({
    order: { id: 'burger-order', tableNumber: 8 },
    item: { productName: 'Cheeseburger', quantity: 1 },
    station: 'station4',
    receiptNumber: '00004',
  });

  assert.match(output.toString('ascii'), /BURGER/);
});

test('wraps long product names to fit the 80mm receipt width', () => {
  const output = formatCashierReceipt({
    mode: 'item',
    receiptNumber: '00003',
    location: 'Masa 12',
    printedAt: '27.10.2026 19:54',
    items: [{
      productName: 'ÇOK UZUN BİR ÜRÜN ADI DÖNER PORSİYON',
      quantity: 12,
    }],
  });
  const decoded = output.toString('ascii');
  assert.doesNotMatch(decoded, /TL|12345,67/);
  const lines = decoded
    .replace(/\x1B[@tEa!]/g, '')
    .replace(/\x1D!\x01|\x1D!\x00/g, '')
    .split('\n')
    .map((line) => line.replace(/[\x00-\x1F\x7F]/g, ''))
    .filter(Boolean);

  assert.ok(lines.every((line) => [...line].length <= 42), lines.join('\n'));
});

test('rejects invalid cashier receipt payloads', () => {
  assert.equal(isValidCashierReceipt({ mode: 'item', items: [] }), false);
  assert.equal(isValidCashierReceipt({
    mode: 'order',
    location: '',
    printedAt: 'now',
    orders: [{ createdAt: 'now', items: [{ productName: 'Ürün', quantity: 1, unitPrice: 5 }] }],
  }), true);
});

test('routes oven, grill, and burger products as separate item tickets', () => {
  const items = [
    { productName: 'Pide', categoryId: 'oven' },
    { productName: 'Kebap', categoryId: 'grill' },
    { productName: 'Çay', categoryId: 'cashier' },
    { productName: 'Burger', categoryId: 'burger' },
  ];
  const categories = [
    { id: 'oven', kitchenStation: 'station1' },
    { id: 'grill', kitchenStation: 'station2' },
    { id: 'cashier', kitchenStation: 'station3' },
    { id: 'burger', kitchenStation: 'station4' },
  ];

  const grouped = groupItemsByStation(items, categories);

  assert.deepEqual(grouped.station1, [{ item: items[0], itemIndex: 0 }]);
  assert.deepEqual(grouped.station2, [{ item: items[1], itemIndex: 1 }]);
  assert.equal(grouped.station3, undefined);
  assert.deepEqual(grouped.station4, [{ item: items[3], itemIndex: 3 }]);
});

test('does not throw when order categories are unavailable', () => {
  assert.deepEqual(groupItemsByStation([{ productName: 'Pide', categoryId: 'oven' }]), {});
  assert.deepEqual(groupItemsByStation(null, []), {});
});

test('tracks kitchen reprint acknowledgements independently for each station', () => {
  const order = {
    kitchenPrintRequestId: 'request-2',
    kitchenPrintHandled: {
      station1: 'request-2',
      station2: 'request-1',
    },
  };

  assert.deepEqual(
    getUnacknowledgedStations(order, ['station1', 'station2', 'station4']),
    ['station2', 'station4'],
  );
  assert.deepEqual(getUnacknowledgedStations({ kitchenPrintRequestId: '' }, ['station1']), []);
});

test('reserves receipt numbers globally starting at 00001', async () => {
  const state = { lastNumber: undefined, resetBy: 'admin-uid', resetAt: 'reset-time' };
  const db = {
    collection: () => ({
      doc: () => ({ id: 'receipt-sequence' }),
    }),
    runTransaction: async (callback) => callback({
      get: async () => ({
        exists: Number.isInteger(state.lastNumber),
        get: () => state.lastNumber,
      }),
      set: (_ref, value) => Object.assign(state, value),
    }),
  };

  assert.deepEqual(await reserveReceiptNumbers(db, 3), ['00001', '00002', '00003']);
  assert.deepEqual(await reserveReceiptNumbers(db, 1), ['00004']);
  assert.equal(state.resetBy, 'admin-uid');
  assert.equal(state.resetAt, 'reset-time');
});
