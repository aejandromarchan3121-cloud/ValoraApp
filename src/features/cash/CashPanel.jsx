import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Stat } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { useEmergencyRule } from '../../hooks/useEmergencyRule';
import { CURRENCIES, METHODS, fmt, toUSD } from '../../lib/money';
import { categorize } from '../../lib/ai';
import { categorizeLocal } from '../../lib/aiLocal';
import { allocateSale } from '../../lib/emergency';
import { glass, chip, chipActive } from '../../lib/glass';
import BsToUsdt from './BsToUsdt';

const pickCur = (...res) => { for (const re of res) { const c = CURRENCIES.find((x) => re.test(String(x))); if (c) return c; } return null; };
// Sugiere la moneda según el método elegido (si no hay pista, deja la actual)
const guessCurrency = (method, cur) =>
  (/usd|zelle|binance|usdt/i.test(method) && pickCur(/^usd$/i, /^usd/i)) ||
  (/m[oó]vil|\bbs\b|bol[ií]var/i.test(method) && pickCur(/ves|bs/i)) ||
  (/nequi|bancolombia|cop/i.test(method) && pickCur(/cop/i)) ||
  (/eur/i.test(method) && pickCur(/eur/i)) || cur;

const QUICK = Object.entries(METHODS).flatMap(([kind, list]) => list.map((method) => ({ kind, method }))).slice(0, 9);

/**
 * Props opcionales:
 *  - onFundContribution(usd): se llama tras registrar un ingreso con el monto USD que va al fondo (conéctalo a tu panel de Emergencia).
 */
export default function CashPanel({ rates, table, onFundContribution }) {
  const { rows, insert, remove, loading, error } = table ?? useTable('cash_entries');
  const { pct } = useEmergencyRule();
  const [f, setF] = useState({ kind: 'cash', method: METHODS.cash[0], currency: 'USD', amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const p2p = rates.p2p?.price;
  const focusAmount = () => formRef.current?.elements.amount?.focus();

  // Atajos: Alt+1..9 elige método · "/" enfoca el monto
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && /^[1-9]$/.test(e.key) && QUICK[+e.key - 1]) {
        e.preventDefault();
        const q = QUICK[+e.key - 1];
        setF((s) => ({ ...s, kind: q.kind, method: q.method, currency: guessCurrency(q.method, s.currency) }));
        focusAmount();
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault(); focusAmount();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totals = useMemo(() => {
    const byKind = { cash: 0, digital: 0 };
    const byCur = {};
    rows.forEach((r) => {
      byKind[r.kind] += toUSD(r.amount, r.currency, { p2p });
      byCur[r.currency] = (byCur[r.currency] ?? 0) + Number(r.amount);
    });
    return { byKind, byCur, all: byKind.cash + byKind.digital };
  }, [rows, p2p]);

  const split = useMemo(() => {
    const usd = +f.amount > 0 ? toUSD(+f.amount, f.currency, { p2p }) : 0;
    return usd && pct > 0 ? allocateSale(usd, pct) : null;
  }, [f.amount, f.currency, p2p, pct]);

  const submit = async (e) => {
    e.preventDefault();
    if (!+f.amount) return;
    setBusy(true);
    try {
      const local = categorizeLocal(f.note);
      await insert({ ...f, amount: +f.amount, category: local !== 'general' ? local : categorize(f.note) });
      if (split?.toFund > 0) onFundContribution?.(split.toFund);
      setF({ ...f, amount: '', note: '' });
      focusAmount();
    } finally { setBusy(false); }
  };

  // Conversión Bs → USDT: sale Bs, entra USDT. Ajusta los nombres de método/moneda si en tu lib/money son distintos.
  const registerConversion = async ({ bs, usdt, rate }) => {
    const note = `Conversión ${bs.toFixed(2)} Bs → ${usdt.toFixed(2)} USDT @ ${rate.toFixed(2)}`;
    const outMethod = METHODS.digital.find((m) => /m[oó]vil/i.test(m)) ?? METHODS.digital[0];
    const inMethod = METHODS.digital.find((m) => /binance|usdt/i.test(m)) ?? METHODS.digital[0];
    await insert({ kind: 'digital', method: outMethod, currency: pickCur(/ves|bs/i) ?? 'VES', amount: -bs, note, category: 'conversión' });
    await insert({ kind: 'digital', method: inMethod, currency: pickCur(/^usdt$/i, /^usd$/i) ?? 'USD', amount: usdt, note, category: 'conversión' });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Caja</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total (USD eq.)" value={fmt(totals.all)} hint="Bs valorados a tasa P2P" />
        <Stat label="Efectivo" value={fmt(totals.byKind.cash)} />
        <Stat label="Digital" value={fmt(totals.byKind.digital)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(totals.byCur).map(([c, v]) => <Badge key={c} tone="brand">{c}: {fmt(v, c)}</Badge>)}
      </div>

      <Card className={`space-y-3 ${glass}`}>
        {/* Selección directa: un toque elige tipo + método + moneda */}
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q, i) => (
            <button key={q.method} type="button" title={`Alt+${i + 1}`}
              onClick={() => { setF({ ...f, kind: q.kind, method: q.method, currency: guessCurrency(q.method, f.currency) }); focusAmount(); }}
              className={`${chip} ${f.method === q.method ? chipActive : ''}`}>{q.method}</button>
          ))}
        </div>

        {/* Modo manual intacto */}
        <form ref={formRef} onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, method: METHODS[e.target.value][0] })}>
            <option value="cash">Efectivo</option><option value="digital">Digital</option>
          </Select>
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value, currency: guessCurrency(e.target.value, f.currency) })}>
            {METHODS[f.kind].map((m) => <option key={m}>{m}</option>)}
          </Select>
          <Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input name="amount" type="number" step="0.01" min="0" placeholder="Monto" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          <Input placeholder="Nota (autocategoriza)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Button disabled={busy}><Plus size={16} /> Registrar</Button>
        </form>
        <p className="flex flex-wrap gap-x-4 text-xs text-zinc-500">
          {f.note && <span>Categoría: <b>{categorizeLocal(f.note)}</b></span>}
          {split && <span>Al fondo de emergencia: <b className="text-emerald-500">{fmt(split.toFund)}</b> ({pct}%)</span>}
          <span className="ml-auto hidden sm:inline">Alt+1…9 método · / monto · Enter registra</span>
        </p>
      </Card>

      <BsToUsdt rates={rates} onRegister={registerConversion} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Card className={`divide-y divide-zinc-100 p-0 dark:divide-zinc-800 ${glass}`}>
        {loading && <p className="p-4 text-sm text-zinc-500">Cargando…</p>}
        {!loading && !rows.length && <p className="p-4 text-sm text-zinc-500">Aún no hay movimientos.</p>}
        {rows.slice(0, 30).map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.method} <Badge>{r.category}</Badge></p>
              <p className="truncate text-xs text-zinc-500">{new Date(r.created_at).toLocaleString('es-VE')} {r.note && `· ${r.note}`}</p>
            </div>
            <p className="font-semibold tabular-nums">{fmt(r.amount, r.currency)}</p>
            <button onClick={() => remove(r.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}
