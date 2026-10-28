import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

export function useWallet() {
  const { user } = useAuth();
  const [state, setState] = useState({ wallet: null, profile: null, txs: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!user) {
      console.log("useWallet: No hay usuario autenticado aún.");
      return;
    }

    console.log("useWallet: Consultando datos para user.id =", user.id);

    try {
      const [w, p, t] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(30),
      ]);

      console.log("useWallet Respuesta w (wallet):", w);
      console.log("useWallet Respuesta p (profile):", p);

      setState({
        wallet: w.data, 
        profile: p.data, 
        txs: t.data ?? [], 
        loading: false,
        error: w.error?.message ?? p.error?.message ?? t.error?.message ?? null,
      });
    } catch (err) {
      console.error("Error crítico en useWallet:", err);
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [user]);

  useEffect(() => { 
    load(); 
  }, [load]);

  return { ...state, userId: user?.id, reload: load };
}