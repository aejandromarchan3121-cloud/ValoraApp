import { api } from './http';
import { CURRENCIES } from '../lib/money';

/** Chat con el asistente (vía backend; la API key nunca está en el navegador). */
export const askAgent = (messages, context) => api('/ai/chat', { method: 'POST', body: { messages, context } });

/** Contexto mínimo: sin notas libres ni datos personales de terceros. */
export function buildContext({ rates, cashTable, fund }) {
  const since = Date.now() - 30 * 864e5;
  const recent = cashTable.rows.filter((r) => new Date(r.created_at) >= since);
  const byCurrency = {};
  recent.forEach((r) => { byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + Number(r.amount); });
  const bcv = rates.bcv?.price ?? null;
  const p2p = rates.p2p?.price ?? null;
  return {
    hoy: new Date().toISOString().slice(0, 10),
    tasas: { bcv, p2p, brecha_pct: bcv && p2p ? +((p2p / bcv - 1) * 100).toFixed(1) : null },
    fondo_emergencia: fund ? { saldo_usd: fund.balance_usd, meta_usd: fund.target_usd } : null,
    ingresos_30d_por_moneda: byCurrency,
    ultimos_movimientos: cashTable.rows.slice(0, 15).map(({ amount, currency, method, category, created_at }) => (
      { amount, currency, method, category, fecha: created_at.slice(0, 10) })),
  };
}

/** La salida del modelo es NO confiable: se valida antes de proponerla al usuario. */
export function sanitizeAction(a) {
  const x = a?.args ?? {};
  if (a?.type === 'register_entry') {
    const amount = Number(x.amount);
    if (!(amount > 0) || !CURRENCIES.includes(x.currency)) return null;
    return {
      type: a.type,
      args: {
        amount, currency: x.currency, kind: x.kind === 'digital' ? 'digital' : 'cash',
        method: String(x.method ?? 'Efectivo USD').slice(0, 40),
        category: String(x.category ?? 'Otros').slice(0, 40),
        note: x.note ? String(x.note).slice(0, 200) : null,
      },
    };
  }
  if (a?.type === 'add_agenda' && x.title) {
    const due = x.due_at && !Number.isNaN(Date.parse(x.due_at)) ? new Date(x.due_at).toISOString() : null;
    return { type: a.type, args: { title: String(x.title).slice(0, 160), due_at: due } };
  }
  return null;
}
