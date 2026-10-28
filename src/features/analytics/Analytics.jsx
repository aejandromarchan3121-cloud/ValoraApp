import { useMemo, useState } from 'react';
import { BarChart3, FlaskConical } from 'lucide-react';
import { Card, EmptyState, PageHeader, Stat, cx } from '../../components/ui';
import { fmt, toUSD } from '../../lib/money';
import { METRICS, RANGES, useRateCandles } from "../../hooks/useRateCandles";
import CandlestickChart from './CandlestickChart';

function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            value === o.id ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Bars({ data }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <EmptyState icon={BarChart3} title="Sin datos todavía" hint="Registra ingresos en Caja para ver el desglose." />;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return entries.map(([k, v]) => (
    <div key={k} className="mb-2">
      <div className="flex justify-between text-xs"><span>{k}</span><span className="tabular-nums">{fmt(v)}</span></div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / max) * 100}%` }} /></div>
    </div>
  ));
}

function Chip({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cx('text-sm font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  );
}

export default function Analytics({ rates, cashTable }) {
  const [metricId, setMetricId] = useState('gap');
  const [range, setRange] = useState('30d');
  const metric = METRICS.find((m) => m.id === metricId);
  const bucket = (RANGES.find((r) => r.id === range) ?? RANGES[2]).bucket;
  const { candles, isDemo, loading, error } = useRateCandles({ metric: metricId, range });

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

  const stats = useMemo(() => {
    if (!candles.length) return null;
    const first = candles[0], last = candles[candles.length - 1];
    const f = (n) => `${n.toFixed(metric.decimals)}${metric.unit}`;
    const delta = last.close - first.open;
    const bad = metric.upIsBad ? delta > 0 : delta < 0;
    return {
      last: f(last.close), max: f(Math.max(...candles.map((c) => c.high))), min: f(Math.min(...candles.map((c) => c.low))),
      delta: `${delta > 0 ? '+' : ''}${delta.toFixed(metric.decimals)}${metric.unit}`,
      deltaTone: delta === 0 ? '' : bad ? 'text-red-500' : 'text-emerald-500',
    };
  }, [candles, metric]);

  return (
    <div className="space-y-5">
      <PageHeader title="Analíticas" subtitle="Comportamiento de las tasas e ingresos de tu negocio." />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Gráfico de velas</p>
            <p className="text-xs text-zinc-500">
              Apertura, máximo, mínimo y cierre por {bucket === 'hour' ? 'hora' : 'día'}.
              {metric.upIsBad ? ' Rojo = la brecha sube (peor para ti).' : ' Verde sube, rojo baja.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented label="Métrica" options={METRICS} value={metricId} onChange={setMetricId} />
            <Segmented label="Rango" options={RANGES} value={range} onChange={setRange} />
          </div>
        </div>

        {isDemo && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <FlaskConical size={16} className="mt-0.5 shrink-0" />
            <span><b>Datos de ejemplo.</b> Se reemplazan solos al acumular historial real: la app guarda una foto de las tasas cada 10 minutos mientras está abierta.</span>
          </div>
        )}
        {error && <p className="text-xs text-red-500">No se pudo leer el historial: {error}</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Chip label="Último" value={stats.last} />
            <Chip label="Variación" value={stats.delta} tone={stats.deltaTone} />
            <Chip label="Máximo" value={stats.max} />
            <Chip label="Mínimo" value={stats.min} />
          </div>
        )}

        {loading ? <p className="py-16 text-center text-sm text-zinc-500">Cargando velas…</p>
          : <CandlestickChart data={candles} metric={metric} bucket={bucket} />}
      </Card>

      <Stat label="Ingresos acumulados (USD eq.)" value={fmt(total)} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><p className="mb-3 text-sm font-medium">Por categoría</p><Bars data={byCat} /></Card>
        <Card><p className="mb-3 text-sm font-medium">Por mes</p><Bars data={byMonth} /></Card>
      </div>
    </div>
  );
}
