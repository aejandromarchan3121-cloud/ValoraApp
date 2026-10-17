import { useState } from 'react';
import { RefreshCw, TrendingDown } from 'lucide-react';
import { Badge, Button, Card, Input, Stat } from '../../components/ui';
import { fmt, pct } from '../../lib/money';

export default function RateComparator({ rates }) {
  const { bcv, p2p, loading, error, reload } = rates;
  const [usd, setUsd] = useState(100);       // precio facturado en USD
  const [cost, setCost] = useState(70);      // costo del producto en USD
  const [days, setDays] = useState(7);       // días reteniendo Bs
  const [devMonthly, setDevMonthly] = useState(10); // % devaluación mensual estimada

  if (loading) return <p className="text-sm text-zinc-500">Cargando tasas…</p>;

  const gap = bcv && p2p ? (p2p.price / bcv.price - 1) * 100 : 0;
  const ves = bcv ? usd * bcv.price : 0;                         // Bs recibidos a tasa BCV
  const usdtNow = p2p ? ves / p2p.price : 0;                     // USDT si conviertes hoy
  const usdtHeld = p2p ? ves / (p2p.price * Math.pow(1 + devMonthly / 100, days / 30)) : 0;
  const lossNow = usd - usdtNow;
  const lossHeld = usd - usdtHeld;
  const marginInvoice = usd ? ((usd - cost) / usd) * 100 : 0;
  const marginReal = usdtNow ? ((usdtNow - cost) / usdtNow) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">BCV vs USDT P2P</h1>
          <p className="text-sm text-zinc-500">Cuánto valor pierdes por la brecha y por esperar.</p>
        </div>
        <Button variant="ghost" onClick={reload}><RefreshCw size={16} /> Actualizar</Button>
      </div>
      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="BCV oficial" value={bcv ? `${bcv.price.toFixed(2)} Bs` : '—'} hint={bcv && `Act. ${bcv.at.toLocaleString('es-VE')}`} />
        <Stat label="USDT P2P (mediana)" value={p2p ? `${p2p.price.toFixed(2)} Bs` : '—'} hint={p2p && `${p2p.samples} anuncios · mejor ${p2p.best.toFixed(2)}`} />
        <Stat label="Brecha" value={pct(gap)} tone={gap > 10 ? 'text-red-500' : gap > 5 ? 'text-amber-500' : 'text-emerald-500'} hint="P2P sobre BCV" />
      </div>

      <Card className="space-y-4">
        <h2 className="font-medium">Simulador de impacto</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-zinc-500">Precio de venta (USD)<Input type="number" min="0" value={usd} onChange={(e) => setUsd(+e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Costo (USD)<Input type="number" min="0" value={cost} onChange={(e) => setCost(+e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Días reteniendo Bs: {days}<input type="range" min="0" max="60" value={days} onChange={(e) => setDays(+e.target.value)} className="mt-3 w-full accent-indigo-500" /></label>
          <label className="text-xs text-zinc-500">Devaluación mensual % (estimada)<Input type="number" min="0" value={devMonthly} onChange={(e) => setDevMonthly(+e.target.value)} /></label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <Badge tone="green">Convertir hoy</Badge>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(usdtNow)} USDT</p>
            <p className="text-xs text-zinc-500">Pierdes {fmt(lossNow)} vs. lo facturado ({pct(usd ? (lossNow / usd) * 100 : 0)})</p>
          </div>
          <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
            <Badge tone="red">Retener {days} días</Badge>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(usdtHeld)} USDT</p>
            <p className="flex items-center gap-1 text-xs text-zinc-500"><TrendingDown size={12} /> Pierdes {fmt(lossHeld)} ({pct(usd ? (lossHeld / usd) * 100 : 0)}). Esperar cuesta {fmt(usdtNow - usdtHeld)} más.</p>
          </div>
          <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
            <Badge>Margen</Badge>
            <p className="mt-2 text-sm">Facturado: <b>{pct(marginInvoice)}</b></p>
            <p className="text-sm">Real tras convertir: <b className={marginReal < marginInvoice ? 'text-red-500' : ''}>{pct(marginReal)}</b></p>
            <p className="mt-1 text-xs text-zinc-500">Si el margen real es bajo, sube el precio.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}