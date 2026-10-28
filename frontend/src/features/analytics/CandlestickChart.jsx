import { Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const GREEN = '#10b981';
const RED = '#ef4444';
const TZ = 'America/Caracas';

const tickLabel = (iso, bucket) => new Intl.DateTimeFormat('es-VE', bucket === 'hour'
  ? { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }
  : { timeZone: TZ, day: '2-digit', month: 'short' }).format(new Date(iso));

const fullLabel = (iso, bucket) => new Intl.DateTimeFormat('es-VE', bucket === 'hour'
  ? { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }
  : { timeZone: TZ, dateStyle: 'full' }).format(new Date(iso));

/**
 * Vela: Recharts no trae candlestick. Se dibuja un <Bar> de rango [mínimo, máximo] y
 * esta forma pinta la mecha (alto-bajo) y el cuerpo (apertura-cierre) interpolando en píxeles.
 */
export function Candle({ x, y, width, height, payload, upColor, downColor }) {
  if ([x, y, width, height].some((v) => typeof v !== 'number' || Number.isNaN(v))) return null;
  const { open, close, high, low } = payload;
  const color = close >= open ? upColor : downColor;
  const top = height < 0 ? y + height : y;
  const h = Math.abs(height);
  const cx = x + width / 2;
  const bodyW = Math.max(width * 0.6, 3);

  if (h < 0.5 || high === low) { // todas las muestras iguales: una línea horizontal
    return <line data-candle="flat" x1={cx - bodyW / 2} x2={cx + bodyW / 2} y1={top} y2={top} stroke={color} strokeWidth={2} />;
  }
  const k = h / (high - low);
  const yOpen = top + (high - open) * k;
  const yClose = top + (high - close) * k;
  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(Math.abs(yOpen - yClose), 1.5);
  return (
    <g data-candle="body">
      <line x1={cx} x2={cx} y1={top} y2={top + h} stroke={color} strokeWidth={1.5} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={1} />
    </g>
  );
}

function CandleTooltip({ active, payload, unit, decimals, bucket, upColor, downColor }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const f = (n) => `${Number(n).toFixed(decimals)}${unit}`;
  const up = d.close >= d.open;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <p className="mb-1 font-medium capitalize">{fullLabel(d.t, bucket)}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-zinc-500">Apertura</dt><dd className="text-right">{f(d.open)}</dd>
        <dt className="text-zinc-500">Máximo</dt><dd className="text-right">{f(d.high)}</dd>
        <dt className="text-zinc-500">Mínimo</dt><dd className="text-right">{f(d.low)}</dd>
        <dt className="text-zinc-500">Cierre</dt><dd className="text-right font-semibold" style={{ color: up ? upColor : downColor }}>{f(d.close)}</dd>
      </dl>
      {d.samples > 0 && <p className="mt-1 text-zinc-500">{d.samples} muestras</p>}
    </div>
  );
}

/** data: [{ t (ISO), open, high, low, close, samples }] · metric: { unit, decimals, upIsBad } */
export default function CandlestickChart({ data, metric, bucket = 'day', height = 320 }) {
  if (!data?.length) return <p className="py-10 text-center text-sm text-zinc-500">Sin datos para mostrar.</p>;

  const upColor = metric.upIsBad ? RED : GREEN;
  const downColor = metric.upIsBad ? GREEN : RED;
  const rows = data.map((d) => ({ ...d, label: tickLabel(d.t, bucket), range: [d.low, d.high] }));

  const lo = Math.min(...rows.map((d) => d.low));
  const hi = Math.max(...rows.map((d) => d.high));
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.01 || 1;
  const first = rows[0];
  const last = rows[rows.length - 1];

  return (
    <div role="img" aria-label={`Gráfico de velas: ${rows.length} velas, último cierre ${last.close.toFixed(metric.decimals)}${metric.unit}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(113,113,122,0.2)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[lo - pad, hi + pad]} allowDataOverflow width={52} tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toFixed(metric.decimals > 1 ? 1 : 0)} />
          <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }}
            content={<CandleTooltip unit={metric.unit} decimals={metric.decimals} bucket={bucket} upColor={upColor} downColor={downColor} />} />
          <ReferenceLine y={last.close} stroke={last.close >= first.open ? upColor : downColor} strokeDasharray="4 4" strokeOpacity={0.6} />
          <Bar dataKey="range" isAnimationActive={false} shape={(p) => <Candle {...p} upColor={upColor} downColor={downColor} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
