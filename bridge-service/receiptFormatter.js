const WIDTH = 42;
const ESC = '\x1B';
const GS = '\x1D';

function isValidCashierReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || !['order', 'item'].includes(receipt.mode)) return false;
  if (
    typeof receipt.location !== 'string'
    || typeof receipt.printedAt !== 'string'
    || (receipt.customerName !== undefined && typeof receipt.customerName !== 'string')
  ) return false;

  if (receipt.mode === 'item') {
    return Array.isArray(receipt.items)
      && receipt.items.length > 0
      && receipt.items.every((item) =>
        typeof item.productName === 'string'
        && Number.isFinite(item.quantity));
  }

  return Array.isArray(receipt.orders)
    && receipt.orders.length > 0
    && receipt.orders.every((order) =>
      typeof order.createdAt === 'string'
      && Array.isArray(order.items)
      && order.items.every((item) =>
        typeof item.productName === 'string'
        && Number.isFinite(item.quantity)
        && Number.isFinite(item.unitPrice)));
}

function formatCashierReceipt(receipt) {
  const lines = [
    `${ESC}@${ESC}2${ESC}a\x01${ESC}E\x01${GS}!\x01TUBA SOFRASI${GS}!\x00${ESC}E\x00`,
  ];

  lines.push(`${ESC}a\x01FİŞ NO: ${sanitize(receipt.receiptNumber)}${ESC}a\x00`);
  if (receipt.location) lines.push(sanitize(receipt.location));
  if (receipt.customerName) lines.push(sanitize(receipt.customerName));
  if (receipt.customerPhone) lines.push(sanitize(receipt.customerPhone));
  lines.push(sanitize(receipt.printedAt), separator(), `${ESC}a\x00`);

  if (receipt.mode === 'item') {
    receipt.items.forEach((item) => {
      lines.push(...formatProduct(`${item.productName} x${item.quantity}`));
    });
  } else {
    receipt.orders.forEach((order, index) => {
      const time = new Date(order.createdAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push(`${ESC}E\x01Adisyon ${index + 1} - ${time}${ESC}E\x00`);
      order.items.forEach((item) => {
        lines.push(...formatItem(
          `${item.productName} x${item.quantity}`,
          formatAmount(item.unitPrice * item.quantity),
        ));
      });
    });
  }

  lines.push(separator());
  if (receipt.discountApplied && receipt.discountAmount > 0) {
    lines.push(...formatItem('Ara Toplam', formatAmount(receipt.rawTotal)));
    lines.push(...formatItem(`İndirim %${receipt.discountRate}`, `-${formatAmount(receipt.discountAmount)}`));
  }
  if (receipt.finalTotal !== undefined) {
    lines.push(...formatItem('TOPLAM', formatAmount(receipt.finalTotal), true));
  }
  lines.push(`${ESC}a\x01${sanitize('Teşekkür ederiz')}${ESC}a\x00\n\n${GS}V\x42\x00${ESC}@`);

  return Buffer.from(toPrinterText(lines.join('\n')), 'ascii');
}

function formatKitchenReceipt({ order, item, station, receiptNumber }) {
  const lines = [
    `${ESC}@${ESC}2${ESC}a\x01${ESC}E\x01${GS}!\x01TUBA SOFRASI${GS}!\x00${ESC}E\x00`,
    `${ESC}a\x01FİŞ NO: ${sanitize(receiptNumber)}${ESC}a\x00`,
  ];

  if (order.tableNumber) {
    lines.push(order.tableLabel || `MASA ${order.tableNumber}`);
  } else {
    lines.push('GEL-AL');
  }
  lines.push(getStationLabel(station), separator());
  lines.push(...formatProduct(`${item.quantity}x ${item.productName}`));
  if (item.notes) lines.push(...wrapText(`Not: ${item.notes}`, WIDTH).map((line) => toPrinterText(line)));
  lines.push(
    separator(),
    new Date().toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    `\n\n${GS}V\x42\x00${ESC}@`,
  );

  return Buffer.from(toPrinterText(lines.join('\n')), 'ascii');
}

function getStationLabel(stationId) {
  const labels = {
    station1: 'FIRIN',
    station2: 'IZGARA',
    station4: 'BURGER',
  };
  return labels[stationId] || stationId.toUpperCase();
}

function formatItem(label, amount, bold = false) {
  const safeLabel = sanitize(label);
  const safeAmount = sanitize(amount);
  const labelWidth = WIDTH - safeAmount.length - 1;
  const wrapped = wrapText(safeLabel, labelWidth);
  const last = wrapped.pop() || '';
  const prefix = bold ? `${ESC}E\x01` : '';
  const suffix = bold ? `${ESC}E\x00` : '';
  const rows = wrapped.map((line) => `${prefix}${line}${suffix}`);

  if (last.length + safeAmount.length + 1 <= WIDTH) {
    rows.push(`${prefix}${last.padEnd(WIDTH - safeAmount.length)}${safeAmount}${suffix}`);
  } else {
    rows.push(`${prefix}${last}${suffix}`);
    rows.push(`${' '.repeat(WIDTH - safeAmount.length)}${safeAmount}`);
  }
  return rows;
}

function formatProduct(label) {
  return wrapText(label, WIDTH).map((line) => `${ESC}E\x01${toPrinterText(line)}${ESC}E\x00`);
}

function wrapText(value, width) {
  const words = sanitize(value).split(/\s+/).filter(Boolean);
  const rows = [];
  let current = '';

  for (const word of words) {
    if ([...word].length > width) {
      if (current) rows.push(current);
      current = '';
      const characters = [...word];
      while (characters.length > width) rows.push(characters.splice(0, width).join(''));
      current = characters.join('');
      continue;
    }

    if (current && [...current, ' ', ...word].length > width) {
      rows.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) rows.push(current);
  return rows;
}

function formatAmount(amount) {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} TL`;
}

function separator() {
  return '-'.repeat(WIDTH);
}

function sanitize(value) {
  return String(value).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toPrinterText(value) {
  const turkishMap = {
    Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U',
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    '₺': 'TL', '×': 'x',
  };
  return String(value)
    .replace(/[ÇĞİÖŞÜçğıöşü₺×]/g, (character) => turkishMap[character])
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x00-\x7F]/g, '');
}

module.exports = {
  formatCashierReceipt,
  formatKitchenReceipt,
  isValidCashierReceipt,
  toPrinterText,
};
