// de-DE: punto de miles y coma decimal incluso con 4 dígitos (es-VE omite el punto en 1000).
export const num = (n, d = 2) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);

export const CURRENCIES = ['USD', 'EUR', 'VES', 'COP'];

export const METHODS = {
  cash: ['Efectivo USD', 'Efectivo EUR', 'Efectivo Bs'],
  digital: ['Pago Móvil', 'Zelle', 'Bancolombia', 'Nequi'],
};

// ⚠️ Valores de respaldo editables: ajústalos o conéctalos a una API propia.
export const FX_FALLBACK = { EUR_USD: 1.08, COP_PER_USD: 4000 };

export const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(n) || 0);

export const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

/** Convierte cualquier moneda a USD. VES usa la tasa P2P (valor real de mercado). */
export function toUSD(amount, currency, { p2p }) {
  const a = Number(amount) || 0;
  switch (currency) {
    case 'USD': return a;
    case 'EUR': return a * FX_FALLBACK.EUR_USD;
    case 'VES': return p2p ? a / p2p : 0;
    case 'COP': return a / FX_FALLBACK.COP_PER_USD;
    default: return 0;
  }
}