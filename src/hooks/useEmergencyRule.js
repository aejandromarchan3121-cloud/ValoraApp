import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // ajusta si tu cliente está en otra ruta

/** % de cada ingreso que va al fondo. Persistido en public.user_settings (supabase/001_user_settings.sql). */
export function useEmergencyRule() {
  const [pct, setPct] = useState(10);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth?.user?.id;
      if (!alive || !id) return setLoading(false);
      setUid(id);
      const { data } = await supabase.from('user_settings').select('emergency_pct').eq('user_id', id).maybeSingle();
      if (alive) { if (data) setPct(Number(data.emergency_pct)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const save = useCallback(async (value) => {
    if (!uid) return false;
    setSaving(true); setPct(value);
    const { error } = await supabase.from('user_settings').upsert({ user_id: uid, emergency_pct: value, updated_at: new Date().toISOString() });
    setSaving(false);
    return !error;
  }, [uid]);

  return { pct, setPct, save, loading, saving };
}
