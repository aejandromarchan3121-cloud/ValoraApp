import { useCallback, useEffect, useState } from 'react';

const CACHE_KEY = 'valora:rates:v1';
const DEFAULT_POLL_MS = 5 * 60 * 1000;

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
};

export function useRates({ pollMs = DEFAULT_POLL_MS } = {}) {
  const [rates, setRates] = useState(() => readCache());
  const [loading, setLoading] = useState(() => !readCache());
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => {
    const c = readCache();
    return c?.fetchedAt ? new Date(c.fetchedAt) : null;
  });

  const load = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/rates', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error('Sin tasas disponibles');
      setRates(data);
      setLastUpdated(new Date(data.fetchedAt));
      setError(null);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    } catch (e) {
      if (e.name !== 'AbortError') setError(e); // se conserva la última tasa en `rates`
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = setInterval(() => load(ctrl.signal), pollMs);
    return () => { ctrl.abort(); clearInterval(id); };
  }, [load, pollMs]);

  const usdt = rates?.usdt?.rate ?? null;
  const bcv = rates?.bcv?.rate ?? null;

  return {
    rates,
    usdt,
    bcv,
    gap: rates?.gap ?? null,
    isReady: usdt > 0 && bcv > 0,
    stale: Boolean(rates?.stale) || Boolean(error),
    loading,
    error,
    lastUpdated,
    refetch: () => load(),
  };
}