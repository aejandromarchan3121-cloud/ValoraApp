import { useState } from 'react';
import { RefreshCw, TrendingDown } from 'lucide-react';
import { Badge, Button, Card, Input, Stat } from '../../components/ui';
import { fmt, pct } from '../../lib/money';
import { recommendPrice } from '../../lib/aiLocal';
import { glass } from '../../lib/glass';

const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-zinc-200/60 dark:bg-white/5 ${className}`} aria-busy="true" />;

export default function RateComparator({ rates }) {
  const { bcv, p2p, loading, error, reload } = rates;
  const [usd, setUsd] = useState(100);
  const [cost, setCost] = useState(70);
  const [days, setDays] = useState(7);
  const [devMonthly, setDevMonthly] = useState(10);

  const isReady = Boolean(bcv?.price && p2p?.price);
  const gap = isReady ? (p2p.price / bcv.price - 1) * 100 : 0;
  const ves = isReady ? usd * bcv.price : 0;
  const usdtNow = isReady ? ves / p2p.price : null;
  const usdtHeld = isReady ? ves / (p2p.price * Math.pow(1 + devMonthly / 100, days / 30)) : null;

  const lossNow = usdtNow !== null ? usd - usdtNow : null;
  const lossHeld = usdtHeld !== null ? usd - usdtHeld : null;
  const marginInvoice = usd ? ((usd - cost) / usd) * 100 : 0;
  const marginReal = usdtNow ? ((usdtNow - cost) / usdtNow) * 100 : null;

  // Precio que mantiene tu margen facturado como margen REAL al convertir hoy
  const suggested = isReady && cost > 0 && marginInvoice > 0 && marginInvoice < 95
    ? recommendPrice({ cost, gapPct: gap, targetMarginPct: marginInvoice }) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">BCV vs USDT P2P</h1>
          <p className="text-sm text-zinc-500">Cuánto valor pierdes por la brecha y por esperar.</p>
        </div>
        <Button variant="ghost" onClick={reload}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar</Button>
      </div>
      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">{error}</p>}

      {loading && !isReady ? (
        <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="BCV oficial" value={bcv?.price ? `${bcv.price.toFixed(2)} Bs` : '—'} hint={bcv?.at && `Act. ${new Date(bcv.at).toLocaleString('es-VE')}`} />
          <Stat label="USDT P2P (mediana)" value={p2p?.price ? `${p2p.price.toFixed(2)} Bs` : '—'} hint={p2p?.samples ? `${p2p.samples} anuncios · mejor ${p2p.best?.toFixed(2)}` : 'Sin datos'} />
          <Stat label="Brecha" value={isReady ? pct(gap) : '—'} tone={gap > 10 ? 'text-red-500' : gap > 5 ? 'text-amber-500' : 'text-emerald-500'} hint="P2P sobre BCV" />
        </div>
      )}

      <Card className={`space-y-4 ${glass}`}>
        <h2 className="font-medium">Simulador de impacto</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-zinc-500">Precio de venta (USD)<Input type="number" min="0" value={usd} onChange={(e) => setUsd(+e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Costo (USD)<Input type="number" min="0" value={cost} onChange={(e) => setCost(+e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Días reteniendo Bs: {days}<input type="range" min="0" max="60" value={days} onChange={(e) => setDays(+e.target.value)} className="mt-3 w-full accent-indigo-500" /></label>
          <label className="text-xs text-zinc-500">Devaluación mensual % (estimada)<Input type="number" min="0" value={devMonthly} onChange={(e) => setDevMonthly(+e.target.value)} /></label>
        </div>

        {!isReady ? (
          loading ? <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : (
            <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-500">
              ⚠️ No se pueden calcular las pérdidas ni el margen porque falta la cotización de USDT P2P / Binance.
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <Badge tone="green">Convertir hoy</Badge>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(usdtNow)} USDT</p>
              <p className="text-xs text-zinc-500">Pierdes {fmt(lossNow)} vs. lo facturado ({pct(usd ? (lossNow / usd) * 100 : 0)})</p>
            </div>

            <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
              <Badge tone="red">Retener {days} días</Badge>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(usdtHeld)} USDT</p>
              <p className="flex items-center gap-1 text-xs text-zinc-500">
                <TrendingDown size={12} /> Pierdes {fmt(lossHeld)} ({pct(usd ? (lossHeld / usd) * 100 : 0)}). Esperar cuesta {fmt(usdtNow - usdtHeld)} más.
              </p>
            </div>

            <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
              <Badge>Margen</Badge>
              <p className="mt-2 text-sm">Facturado: <b>{pct(marginInvoice)}</b></p>
              <p className="text-sm">Real tras convertir: <b className={marginReal < marginInvoice ? 'text-red-500' : ''}>{pct(marginReal)}</b></p>
              {suggested && marginReal < marginInvoice - 0.5
                ? <p className="mt-1 text-xs text-zinc-500">Para sostener {pct(marginInvoice)} real, cobra al menos <b className="text-indigo-500">{fmt(suggested.price)}</b> (+{suggested.vsCostPct}% sobre costo).</p>
                : <p className="mt-1 text-xs text-zinc-500">Si el margen real es bajo, sube el precio.</p>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
