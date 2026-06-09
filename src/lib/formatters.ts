import { Timestamp } from 'firebase/firestore';

export function formatCurrency(amount: number, currency = 'BHD'): string {
  const decimals = currency === 'BHD' ? 3 : 2;
  return new Intl.NumberFormat('en-BH', {
    style:                 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatDate(ts: Timestamp | Date | null): string {
  if (!ts) return '—';
  const date = ts instanceof Timestamp ? ts.toDate() : ts;
  return date.toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

export function formatDateTime(ts: Timestamp | Date | null): string {
  if (!ts) return '—';
  const date = ts instanceof Timestamp ? ts.toDate() : ts;
  return date.toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function formatQty(qty: number, unit: string): string {
  return `${qty.toLocaleString()} ${unit}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-BH');
}

export function hexToRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export function stripPhone(phone: string): string {
  return phone.replace(/[\s\-\+]/g, '');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${stripPhone(phone)}?text=${encodeURIComponent(message)}`;
}
