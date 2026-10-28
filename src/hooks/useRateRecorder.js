import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Guarda una foto de las tasas (BCV y P2P) como máximo cada `minutes` mientras la app está abierta.
 * Alimenta el gráfico de velas. Móntalo una vez en el Dashboard (siempre visible).
 * Historial continuo aunque nadie tenga la app abierta: mueve esta captura a un cron en el backend.
 */
export function useRateRecorder({ bcv, p2p }, { minutes = 10 } = {}) {
  const { user } = useAuth();
  const last = useRef(0);
  const bcvPrice = bcv?.price;
  const p2pPrice = p2p?.price;

  useEffect(() => {
    if (!user || !bcvPrice || !p2pPrice) return;
    const now = Date.now();
    if (now - last.current < minutes * 60_000) return;
    last.current = now; // evita doble inserción mientras se resuelve la consulta
    (async () => {
      const { data } = await supabase.from('rate_snapshots').select('created_at')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data && now - new Date(data.created_at).getTime() < minutes * 60_000) return;
      await supabase.from('rate_snapshots').insert({ bcv: bcvPrice, p2p: p2pPrice });
    })();
  }, [user, bcvPrice, p2pPrice, minutes]);
}
