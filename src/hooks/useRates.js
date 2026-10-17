import { useCallback, useEffect, useState } from 'react';

export function useRates(intervalMs = 60_000) {
  const [state, setState] = useState({ 
    bcv: null, 
    p2p: null, 
    gap: null,
    stale: false,
    loading: true, 
    error: null 
  });

  const load = useCallback(async () => {
    try {
      // Ojapo fetch pe endpoint Serverless Vercel-pe oĩva
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      
      const data = await res.json();

      if (!data.ok && !data.usdt && !data.bcv) {
        throw new Error('Ndaikatúi oñemboguejy umi tasa');
      }

      setState({
        // Omohenda pe formato oikotevẽva nde UI (RateComparator ha ambue)
        bcv: data.bcv ? { price: data.bcv.rate, at: data.bcv.updatedAt || data.fetchedAt } : null,
        p2p: data.usdt ? { price: data.usdt.rate, samples: 10, best: data.usdt.rate, source: data.usdt.source } : null,
        gap: data.gap ? data.gap.pct : 0,
        stale: data.stale || false,
        loading: false,
        error: data.errors && data.errors.length > 0 && (!data.usdt || !data.bcv) 
          ? 'Ojejuhu apañuãi Binance-pe, ojeporu hína API de respaldo.' 
          : null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Error al conectar con el servidor',
      }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { ...state, reload: load };
}