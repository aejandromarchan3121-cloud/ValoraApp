import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/** Billetera + perfil + últimos movimientos, con actualización en tiempo real (RLS aplica). */
export function useWallet() {
  const { user } = useAuth();
  const [state, setState] = useState({ wallet: null, profile: null, txs: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!user) return;
    const [w, p, t] = await Promise.all([
      supabase.from('wallets').select('*').maybeSingle(),
      supabase.from('profiles').select('id, username, full_name, phone, is_verified').eq('id', user.id).maybeSingle(),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    setState({
      wallet: w.data, profile: p.data, txs: t.data ?? [], loading: false,
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
