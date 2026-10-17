import { useMemo } from 'react';
import { Card, Stat } from '../../components/ui';
import { fmt, toUSD } from '../../lib/money';

export default function Analytics({ rates, cashTable }) {
  const p2p = rates.p2p?.price;
  const { byCat, byMonth, total } = useMemo(() => {
    const byCat = {}, byMonth = {};
    let total = 0;
    cashTable.rows.forEach((r) => {
      const u = toUSD(r.amount, r.currency, { p2p });
      byCat[r.category] = (byCat[r.category] ?? 0) + u;
      const k = r.created_at.slice(0, 7);
      byMonth[k] = (byMonth[k] ?? 0) + u;
      total += u;
    });
    return { byCat, byMonth, total };
  }, [cashTable.rows, p2p]);

  const Bars = ({ data }) => {
    const max = Math.max(...Object.values(data), 1);
    return Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
      <div key={k} className="mb-2">
        <div className="flex justify-between text-xs"><span>{k}</span><span className="tabular-nums">{fmt(v)}</span></div>
        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / max) * 100}%` }} /></div>
      </div>
    ));
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Analíticas</h1>
      <Stat label="Ingresos acumulados (USD eq.)" value={fmt(total)} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><p className="mb-3 text-sm font-medium">Por categoría</p><Bars data={byCat} /></Card>
        <Card><p className="mb-3 text-sm font-medium">Por mes</p><Bars data={byMonth} /></Card>
      </div>
    </div>
  );
}