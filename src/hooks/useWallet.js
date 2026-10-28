import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

/** Billetera + perfil + últimos movimientos, con actualización en tiempo real (RLS aplica). */
export function useWallet() {
  const { user } = useAuth();
  const [state, setState] = useState({ wallet: null, profile: null, txs: [], loading: true, error: null });
 const load = useCallback(async () => {
    if (!user) {
      console.log("useWallet: Esperando usuario...");
      return;
    }
    console.log("useWallet: Cargando datos para el usuario:", user.id);

    const [w, p, t] = await Promise.all([
  supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
  supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(30),
]);

    console.log("Resultado Wallets:", w);

    setState({
      wallet: w.data, 
      profile: p.data, 
      txs: t.data ?? [], 
      loading: false,
      error: w.error?.message ?? p.error?.message ?? t.error?.message ?? null,
    });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return undefined;
    const ch = supabase
      .channel(`wallet-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  return { ...state, userId: user?.id, reload: load };
}
