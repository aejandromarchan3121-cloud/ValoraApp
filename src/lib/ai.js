const RULES = [
  ['Ventas', /venta|vend[ií]|cobr[eé]|cliente|factura|pago de/i],
  ['Repuestos / Inventario', /repuesto|mercanc[ií]a|proveedor|stock|compra de/i],
  ['Servicios', /luz|agua|internet|alquiler|renta|local|nómina|nomina|sueldo/i],
  ['Transporte', /gasolina|flete|env[ií]o|delivery|transporte/i],
  ['Fondo emergencia', /emergencia|reserva|reguardo/i],
];
export const categorize = (text = '') => RULES.find(([, re]) => re.test(text))?.[0] ?? 'Otros';

const CUR = [['USD', /usd|\$|d[oó]lar/i], ['EUR', /eur|€|euro/i], ['COP', /cop|peso/i], ['VES', /\bbs\b|bol[ií]var|ves/i]];
const MET = [
  ['Pago Móvil', 'digital', /pago\s*m[oó]vil/i], ['Zelle', 'digital', /zelle/i],
  ['Bancolombia', 'digital', /bancolombia/i], ['Nequi', 'digital', /nequi/i],
  ['Efectivo', 'cash', /efectivo|cash/i],
];

/** "recibí 50 usd por pago móvil de repuestos" → entrada sugerida */
export function parseEntry(text) {
  const amount = Number(text.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.'));
  if (!amount) return null;
  const currency = CUR.find(([, re]) => re.test(text))?.[0] ?? 'USD';
  const m = MET.find(([, , re]) => re.test(text));
  const method = m ? (m[0] === 'Efectivo' ? `Efectivo ${currency === 'VES' ? 'Bs' : currency}` : m[0]) : 'Efectivo USD';
  return { amount, currency, method, kind: m?.[1] ?? 'cash', category: categorize(text), note: text };
}

/** Recomendaciones de flujo de caja a partir de datos reales */
export function cashflowInsights({ entries, p2p, bcv, fund }) {
  const tips = [];
  const since = Date.now() - 30 * 864e5;
  const recent = entries.filter((e) => new Date(e.created_at) >= since);
  const total = recent.reduce((s, e) => s + (e.currency === 'VES' ? e.amount / (p2p || 1) : e.currency === 'USD' ? e.amount : 0), 0);
  const ves = recent.filter((e) => e.currency === 'VES').reduce((s, e) => s + e.amount / (p2p || 1), 0);
  if (total > 0 && ves / total > 0.5)
    tips.push(`El ${Math.round((ves / total) * 100)}% de tus ingresos de 30 días está en bolívares. Convierte a USDT al cierre del día para no exponerte a la devaluación.`);
  if (p2p && bcv && p2p / bcv - 1 > 0.1)
    tips.push(`La brecha BCV–P2P es de ${((p2p / bcv - 1) * 100).toFixed(1)}%. Cada USD cobrado a tasa BCV te rinde menos USDT reales: ajusta tus precios.`);
  if (fund && fund.balance_usd < fund.target_usd * 0.25)
    tips.push('Tu fondo de emergencia está por debajo del 25% de la meta. Aparta un % fijo de cada venta.');
  if (!recent.length) tips.push('No hay ingresos registrados en 30 días. Registra tus entradas para recibir recomendaciones.');
  if (!tips.length) tips.push('Flujo de caja saludable. Mantén la disciplina de conversión diaria.');
  return tips;
}