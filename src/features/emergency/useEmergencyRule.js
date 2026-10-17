import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/** % de cada venta que va al fondo. Persistido en public.user_settings (ver supabase/001_user_settings.sql). */
export function useEmergencyRule(userId) {
  const [pct, setPct] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    supabase.from('user_settings').select('emergency_pct').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (alive) { if (data) setPct(Number(data.emergency_pct)); setLoading(false); } });
    return () => { alive = false; };
  }, [userId]);

  const save = useCallback(async (value) => {
    setSaving(true);
    setPct(value);
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, emergency_pct: value, updated_at: new Date().toISOString() });
    setSaving(false);
    return !error;
  }, [userId]);

  return { pct, setPct, save, loading, saving };
}
