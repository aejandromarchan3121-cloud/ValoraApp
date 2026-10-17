// api/rates.js — Vercel Serverless Function (ESM, Node 18+)
const TIMEOUT_MS = 6000;
const RETRIES = 2;
const UA = 'Mozilla/5.0 (compatible; ValoraApp/1.0)';

let lastGood = { usdt: null, bcv: null }; // caché en memoria (best-effort)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isValid = (n) => Number.isFinite(n) && n > 1 && n < 100000;
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function fetchJson(url, options = {}) {
  let lastErr;
  for (let i = 0; i <= RETRIES; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...options,
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: 'application/json', ...options.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (/HTTP (403|404)/.test(e.message)) break; // reintentar no lo arregla
      await sleep(300 * 2 ** i); // backoff: 300ms, 600ms, 1200ms
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

/* ---------- Fuentes USDT (Bs por 1 USDT) ---------- */
const USDT_SOURCES = [
  ['binance-p2p', async () => {
    const data = await fetchJson('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiat: 'VES', asset: 'USDT', tradeType: 'BUY', page: 1, rows: 10,
        payTypes: [], publisherType: null, countries: [],
        proMerchantAds: false, shieldMerchantAds: false, classifies: ['mass', 'profession'],
      }),
    });
    const prices = (data?.data || []).map((a) => parseFloat(a?.adv?.price)).filter(isValid);
    if (prices.length < 3) throw new Error('pocos anuncios');
    return { rate: median(prices) };
  }],

  ['bybit-p2p', async () => {
    const data = await fetchJson('https://api2.bybit.com/fiat/otc/item/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '', tokenId: 'USDT', currencyId: 'VES', payment: [],
        side: '1', size: '10', page: '1', amount: '', authMaker: false, canTrade: false,
      }),
    });
    const prices = (data?.result?.items || []).map((i) => parseFloat(i.price)).filter(isValid);
    if (prices.length < 3) throw new Error('pocos anuncios');
    return { rate: median(prices) };
  }],

  ['criptoya', async () => {
    const data = await fetchJson('https://criptoya.com/api/USDT/VES/1');
    const asks = Object.values(data || {})
      .map((v) => Number(v?.totalAsk ?? v?.ask))
      .filter(isValid);
    if (!asks.length) throw new Error('sin datos');
    return { rate: median(asks) };
  }],

  ['dolarapi-paralelo', async () => {
    const d = await fetchJson('https://ve.dolarapi.com/v1/dolares/paralelo');
    const rate = Number(d?.promedio ?? d?.venta);
    if (!isValid(rate)) throw new Error('tasa inválida');
    return { rate, updatedAt: d?.fechaActualizacion };
  }],
];

/* ---------- Fuentes BCV ---------- */
const BCV_SOURCES = [
  ['dolarapi-oficial', async () => {
    const d = await fetchJson('https://ve.dolarapi.com/v1/dolares/oficial');
    const rate = Number(d?.promedio ?? d?.venta);
    if (!isValid(rate)) throw new Error('tasa inválida');
    return { rate, updatedAt: d?.fechaActualizacion };
  }],
  ['pydolarve', async () => {
    const d = await fetchJson('https://pydolarve.org/api/v1/dollar?page=bcv&monitor=usd');
    const rate = Number(d?.price);
    if (!isValid(rate)) throw new Error('tasa inválida');
    return { rate, updatedAt: d?.last_update };
  }],
];

/* ---------- Cascada ---------- */
async function cascade(sources, errors) {
  for (const [name, fn] of sources) {
    try {
      const out = await fn();
      return { ...out, source: name };
    } catch (e) {
      errors.push({ source: name, error: e.message });
    }
  }
  return null;
}

export default async function handler(req, res) {
  const errors = [];
  const [usdt, bcv] = await Promise.all([
    cascade(USDT_SOURCES, errors),
    cascade(BCV_SOURCES, errors),
  ]);

  if (usdt) lastGood.usdt = { ...usdt, fetchedAt: new Date().toISOString() };
  if (bcv) lastGood.bcv = { ...bcv, fetchedAt: new Date().toISOString() };

  const u = usdt ?? (lastGood.usdt && { ...lastGood.usdt, stale: true });
  const b = bcv ?? (lastGood.bcv && { ...lastGood.bcv, stale: true });

  if (!u && !b) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, errors });
  }

  const gap = u && b
    ? { abs: u.rate - b.rate, pct: ((u.rate - b.rate) / b.rate) * 100 }
    : null;

  const degraded = !usdt || !bcv;
  res.setHeader(
    'Cache-Control',
    degraded ? 's-maxage=60' : 's-maxage=300, stale-while-revalidate=600'
  );
  return res.status(200).json({
    ok: true,
    usdt: u,
    bcv: b,
    gap,
    stale: degraded,
    fetchedAt: new Date().toISOString(),
    errors, // útil para depurar; quítalo si no quieres exponerlo
  });
}