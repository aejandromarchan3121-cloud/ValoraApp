import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildDemoCandles } from '../lib/demoCandles';

export const RANGES = [
  { id: '24h', label: '24 h', bucket: 'hour', days: 1, count: 24 },
  { id: '7d', label: '7 d', bucket: 'day', days: 7, count: 7 },
  { id: '30d', label: '30 d', bucket: 'day', days: 30, count: 30 },
  { id: '90d', label: '90 d', bucket: 'day', days: 90, count: 90 },
];

export const METRICS = [
  // upIsBad: una brecha que sube es peor para el comerciante → se pinta en rojo
  { id: 'gap', label: 'Brecha %', unit: '%', decimals: 2, upIsBad: true },
  { id: 'p2p', label: 'P2P (Bs)', unit: ' Bs', decimals: 2, upIsBad: false },
  { id: 'bcv', label: 'BCV (Bs)', unit: ' Bs', decimals: 2, upIsBad: false },
];

/** Velas OHLC desde la BD (`rate_candles`); si aún no hay historial, devuelve datos de ejemplo. */
export function useRateCandles({ metric = 'gap', range = '30d' }) {
  const cfg = RANGES.find((r) => r.id === range) ?? RANGES[2];
  const [state, setState] = useState({ real: [], loading: true, error: null });

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('rate_candles', { p_bucket: cfg.bucket, p_metric: metric, p_days: cfg.days });
    setState({
      loading: false,
      error: error?.message ?? null,
      real: (data ?? []).map((d) => ({
        t: d.bucket, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), samples: d.samples,
      })),
    });
  }, [cfg.bucket, cfg.days, metric]);

  useEffect(() => { setState((s) => ({ ...s, loading: true })); load(); }, [load]);

  const demo = useMemo(
    () => buildDemoCandles({ metric, bucket: cfg.bucket, count: cfg.count }),
    [metric, cfg.bucket, cfg.count],
  );
  const isDemo = !state.loading && state.real.length < 2;
  return { candles: isDemo ? demo : state.real, isDemo, loading: state.loading, error: state.error, reload: load };
}
