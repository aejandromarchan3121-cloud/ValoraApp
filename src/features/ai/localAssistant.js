/** IA 100% local y gratuita: reglas + diccionario. Sin llamadas externas, sin costo, funciona offline. */

const CATEGORIES = {
  repuestos:  ['repuesto', 'pieza', 'cauchos', 'caucho', 'bujia', 'aceite', 'filtro', 'cadena', 'pastilla', 'frenos'],
  servicios:  ['servicio', 'taller', 'mano de obra', 'reparacion', 'instalacion'],
  proveedor:  ['proveedor', 'mayorista', 'mercancia', 'reposicion'],
  nomina:     ['nomina', 'sueldo', 'empleado', 'comision'],
  operativo:  ['alquiler', 'luz', 'internet', 'agua', 'transporte', 'gasolina', 'flete', 'delivery'],
  impuestos:  ['iva', 'islr', 'seniat', 'impuesto', 'patente', 'alcaldia'],
  ahorro:     ['fondo', 'ahorro', 'reserva', 'usdt', 'binance'],
};
const METHODS = { zelle: 'zelle', 'pago movil': 'pagomovil', pagomovil: 'pagomovil', nequi: 'nequi',
  bancolombia: 'bancolombia', efectivo: 'cash_usd', cash: 'cash_usd', binance: 'usdt' };
const CURRENCIES = [['usdt', 'USDT'], ['usd', 'USD'], ['$', 'USD'], ['eur', 'EUR'], ['€', 'EUR'], ['cop', 'COP'], ['bolivares', 'VES'], [' bs', 'VES']];
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

/** "recibí 50 usd por zelle de repuestos" | "pagué 20 usd flete" | "agenda: pagar proveedor viernes" */
export function parseNote(input = '') {
  const raw = input.trim();
  const t = ` ${norm(raw)}`;

  if (/^\s*agenda\s*:/.test(t)) return { intent: 'agenda', text: raw.replace(/^agenda\s*:\s*/i, '') };

  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return { intent: 'unknown', text: raw };
  const amount = parseFloat(m[1].replace(',', '.'));

  const income = /\b(recibi|cobre|cobro|vendi|venta|ingreso|me pagaron|entro)\b/.test(t);
  const expense = /\b(pague|gaste|gasto|compre|compra|egreso)\b/.test(t);
  const currency = (CURRENCIES.find(([k]) => t.includes(k)) || [null, 'USD'])[1];
  const method = Object.entries(METHODS).find(([k]) => t.includes(k))?.[1] || null;

  return { intent: expense && !income ? 'expense' : 'income', amount, currency, method, category: categorize(raw).category, note: raw };
}

/**
 * Precio mínimo para conservar un margen objetivo tras la brecha (y devaluación si retienes Bs).
 * margen = (precio - costo) / precio  (igual que tu simulador).
 */
export function recommendPrice({ cost, gapPct, targetMarginPct = 30, monthlyDevalPct = 0, holdDays = 0 }) {
  const m = targetMarginPct / 100;
  const gap = 1 + gapPct / 100;
  const hold = 1 + (monthlyDevalPct / 100) * (holdDays / 30);
  const price = (cost * gap * hold) / (1 - m);
  return { price: +price.toFixed(2), vsCostPct: +(((price - cost) / cost) * 100).toFixed(1) };
}

/** Recomendaciones para el panel Asistente. */
export function buildAdvice({ gapPct, cost, price, monthlyDevalPct = 10, holdDays = 7, emergencyPct, reservePct }) {
  const tips = [];
  if (gapPct != null && cost && price) {
    const usdt = price / (1 + gapPct / 100);
    const real = ((usdt - cost) / usdt) * 100;
    const rec = recommendPrice({ cost, gapPct, monthlyDevalPct, holdDays });
    if (real < 25) tips.push(`Tu margen real tras convertir es ${real.toFixed(1)}%. Para sostener 30% con brecha ${gapPct.toFixed(1)}% el precio mínimo es USD ${rec.price}.`);
  }
  if (gapPct > 10) tips.push('Brecha alta: convierte a USDT el mismo día en vez de retener bolívares.');
  if (reservePct != null && reservePct < 25) tips.push('Tu fondo de emergencia está bajo el 25% de la meta: sube el % automático por venta.');
  if (emergencyPct === 0) tips.push('No tienes aporte automático al fondo; configúralo en Emergencia.');
  return tips;
}
