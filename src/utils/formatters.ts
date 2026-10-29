export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:    'Bekliyor',
    preparing:  'Hazırlanıyor',
    ready:      'Hazır',
    delivered:  'Teslim Edildi',
    paid:       'Ödendi',
    cancelled:  'İptal',
  };
  return map[status] ?? status;
}

export function tableStatusLabel(status: string): string {
  const map: Record<string, string> = {
    available:      'Boş',
    occupied:       'Dolu',
  };
  return map[status] ?? 'Boş';
}

export function tableStatusColor(status: string): string {
  const map: Record<string, string> = {
    available:      'bg-green-100 text-green-800',
    occupied:       'bg-blue-100 text-blue-800',
  };
  return map[status] ?? map.available;
}
