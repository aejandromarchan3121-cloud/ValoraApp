const URL = import.meta.env.VITE_P2P_URL;

/**
 * Tasa USDT/VES. Para un comerciante que convierte Bs → USDT, compra USDT: tradeType 'BUY'.
 * Devuelve la mediana de los primeros anuncios (más robusta que el mejor precio).
 */
export async function fetchP2PRate({ fiat = 'VES', tradeType = 'BUY', rows = 10, payTypes = [] } = {}) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fiat, page: 1, rows, tradeType, asset: 'USDT', countries: [],
      proMerchantAds: false, shieldMerchantAds: false, publisherType: null, payTypes,
    }),
  });
  if (!res.ok) throw new Error(`Binance P2P respondió ${res.status}`);
  const { data } = await res.json();
  const prices = (data ?? []).map((d) => Number(d.adv.price)).filter(Boolean);
  if (!prices.length) throw new Error('Sin anuncios P2P disponibles');
  const s = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return { price: median, best: tradeType === 'BUY' ? s[0] : s[s.length - 1], samples: s.length, at: new Date() };
}