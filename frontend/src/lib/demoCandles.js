/** Velas de ejemplo (determinísticas) para mostrar el gráfico antes de tener historial real. */
const r2 = (n) => Math.round(n * 100) / 100;

export function buildDemoCandles({ metric = 'gap', bucket = 'day', count = 30, seed = 7 }) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const base = { gap: 13, p2p: 1000, bcv: 880 }[metric] ?? 13;
  const vol = { gap: 0.8, p2p: 6, bcv: 1.2 }[metric] ?? 1;
  const drift = metric === 'bcv' ? 0.4 : 0;
  const step = bucket === 'hour' ? 3600e3 : 864e5;
  const end = Date.now();
  let prev = base;
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const open = prev;
    const close = open + (rnd() - 0.5) * 2 * vol + drift;
    const high = Math.max(open, close) + rnd() * vol * 0.6;
    const low = Math.min(open, close) - rnd() * vol * 0.6;
    out.push({ t: new Date(end - i * step).toISOString(), open: r2(open), high: r2(high), low: r2(low), close: r2(close), samples: 0 });
    prev = close;
  }
  return out;
}
