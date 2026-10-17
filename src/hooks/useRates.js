import { useCallback, useEffect, useState } from 'react';
import { fetchP2PRate } from '../api/p2p';
import { fetchBCVRate } from '../api/bcv';

export function useRates(intervalMs = 60_000) {
  const [state, setState] = useState({ bcv: null, p2p: null, loading: true, error: null });

  const load = useCallback(async () => {
    const [b, p] = await Promise.allSettled([fetchBCVRate(), fetchP2PRate()]);
    setState((s) => ({
      bcv: b.status === 'fulfilled' ? b.value : s.bcv,
      p2p: p.status === 'fulfilled' ? p.value : s.p2p,
      loading: false,
      error: [b, p].filter((r) => r.status === 'rejected').map((r) => r.reason.message).join(' · ') || null,
    }));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { ...state, reload: load };
}