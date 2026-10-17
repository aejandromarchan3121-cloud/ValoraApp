/** IA local y gratuita (reglas + diccionario). No reemplaza lib/ai.js: se usa primero y cae a tu categorize() si da 'general'. */
const CATEGORIES = {
  repuestos: ['repuesto', 'pieza', 'caucho', 'bujia', 'aceite', 'filtro', 'cadena', 'pastilla', 'freno'],
  servicios: ['servicio', 'taller', 'mano de obra', 'reparacion', 'instalacion'],
  proveedor: ['proveedor', 'mayorista', 'mercancia', 'reposicion'],
  nomina:    ['nomina', 'sueldo', 'empleado', 'comision'],
  operativo: ['alquiler', 'luz', 'internet', 'agua', 'transporte', 'gasolina', 'flete', 'delivery'],
  impuestos: ['iva', 'islr', 'seniat', 'impuesto', 'patente', 'alcaldia'],
  ahorro:    ['fondo', 'ahorro', 'reserva', 'usdt', 'binance'],
};
const METHOD_WORDS = { zelle: 'Zelle', 'pago movil': 'Pago Móvil', pagomovil: 'Pago Móvil', nequi: 'Nequi', bancolombia: 'Bancolombia', efectivo: 'Efectivo', binance: 'Binance' };
const CUR_WORDS = [['usdt', 'USDT'], ['usd', 'USD'], ['$', 'USD'], ['eur', 'EUR'], ['cop', 'COP'], ['bolivares', 'VES'], [' bs', 'VES']];
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function categorize(text = '') {
  const t = norm(text);
  let best = { category: 'general', score: 0 };
  for (const [cat, words] of Object.entries(CATEGORIES)) {
    const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    if (score > best.score) best = { category: cat, score };
  }
  return best;
}
export const categorizeLocal = (text) => categorize(text).category;

/** "recibí 50 usd por zelle de repuestos" | "pagué 20 usd flete" | "agenda: pagar proveedor viernes" */
export function parseNote(input = '') {
  const raw = input.trim();
  const t = ` ${norm(raw)}`;
  if (/^\s*agenda\s*:/.test(t)) return { intent: 'agenda', text: raw.replace(/^agenda\s*:\s*/i, '') };
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return { intent: 'unknown', text: raw };
  const income = /\b(recibi|cobre|cobro|vendi|venta|ingreso|me pagaron|entro)\b/.test(t);
  const expense = /\b(pague|gaste|gasto|compre|compra|egreso)\b/.test(t);
  return {
    intent: expense && !income ? 'expense' : 'income',
    amount: parseFloat(m[1].replace(',', '.')),
    currency: (CUR_WORDS.find(([k]) => t.includes(k)) || [null, 'USD'])[1],
    method: Object.entries(METHOD_WORDS).find(([k]) => t.includes(k))?.[1] || null,
    category: categorize(raw).category,
    note: raw,
  };
}

/** Precio mínimo para sostener un margen objetivo. margen = (precio - costo) / precio, igual que tu simulador. */
export function recommendPrice({ cost, gapPct, targetMarginPct = 30, monthlyDevalPct = 0, holdDays = 0 }) {
  const m = Math.min(targetMarginPct, 95) / 100;
  const price = (cost * (1 + gapPct / 100) * (1 + (monthlyDevalPct / 100) * (holdDays / 30))) / (1 - m);
  return { price: +price.toFixed(2), vsCostPct: +(((price - cost) / cost) * 100).toFixed(1) };
}

/** Lista de recomendaciones para el panel Asistente. */
export function buildAdvice({ gapPct, cost, price, monthlyDevalPct = 10, holdDays = 7, emergencyPct, reservePct }) {
  const tips = [];
  if (gapPct != null && cost && price) {
    const usdt = price / (1 + gapPct / 100);
    const real = ((usdt - cost) / usdt) * 100;
    if (real < 25) tips.push(`Tu margen real tras convertir es ${real.toFixed(1)}%. Para sostener 30% con brecha ${gapPct.toFixed(1)}% el precio mínimo es USD ${recommendPrice({ cost, gapPct, monthlyDevalPct, holdDays }).price}.`);
  }
  if (gapPct > 10) tips.push('Brecha alta: convierte a USDT el mismo día en vez de retener bolívares.');
  if (reservePct != null && reservePct < 25) tips.push('Tu fondo de emergencia está bajo el 25% de la meta: sube el % automático por venta.');
  if (emergencyPct === 0) tips.push('No tienes aporte automático al fondo; configúralo en Emergencia.');
  return tips;
}
