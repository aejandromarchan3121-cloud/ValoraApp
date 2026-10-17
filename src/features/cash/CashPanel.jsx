import { useMemo, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Stat } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { CURRENCIES, METHODS, fmt, toUSD } from '../../lib/money';
import { categorize } from '../../lib/ai';

export default function CashPanel({ rates, table }) {
  const { rows, insert, remove, loading, error } = table ?? useTable('cash_entries');
  const [f, setF] = useState({ kind: 'cash', method: 'Efectivo USD', currency: 'USD', amount: '', note: '' });
  const [busy, setBusy] = useState(false);
  const p2p = rates.p2p?.price;

  const totals = useMemo(() => {
    const byKind = { cash: 0, digital: 0 };
    const byCur = {};
    rows.forEach((r) => {
      byKind[r.kind] += toUSD(r.amount, r.currency, { p2p });
      byCur[r.currency] = (byCur[r.currency] ?? 0) + Number(r.amount);
    });
    return { byKind, byCur, all: byKind.cash + byKind.digital };
  }, [rows, p2p]);

  const submit = async (e) => {
    e.preventDefault();
    if (!+f.amount) return;
    setBusy(true);
    try { await insert({ ...f, amount: +f.amount, category: categorize(f.note) }); setF({ ...f, amount: '', note: '' }); }
    finally { setBusy(false); }
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

      <Card>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, method: METHODS[e.target.value][0] })}>
            <option value="cash">Efectivo</option><option value="digital">Digital</option>
          </Select>
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {METHODS[f.kind].map((m) => <option key={m}>{m}</option>)}
          </Select>
          <Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input type="number" step="0.01" min="0" placeholder="Monto" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          <Input className="sm:col-span-1" placeholder="Nota (autocategoriza)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Button disabled={busy}><Plus size={16} /> Registrar</Button>
        </form>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Card className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
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