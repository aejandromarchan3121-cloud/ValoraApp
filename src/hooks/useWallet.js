import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

/** Billetera + perfil + últimos movimientos, optimizado sin WebSockets molestos. */
export function useWallet() {
  const { user } = useAuth();
  const [state, setState] = useState({ wallet: null, profile: null, txs: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!user) return;
    
    const [w, p, t] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(30),
    ]);

    setState({
      wallet: w.data, 
      profile: p.data, 
      txs: t.data ?? [], 
      loading: false,
      error: w.error?.message ?? p.error?.message ?? t.error?.message ?? null,
    });
  }, [user]);

  useEffect(() => { 
    load(); 
  }, [load]);

  // Se eliminó la suscripción por WebSocket que causaba el conflicto y el bloqueo.

  return { ...state, userId: user?.id, reload: load };
}