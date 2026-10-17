import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/** CRUD genérico sobre una tabla con RLS. */
export function useTable(table, orderBy = 'created_at') {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false });
    if (error) setError(error.message); else { setRows(data); setError(null); }
    setLoading(false);
  }, [table, orderBy]);

  useEffect(() => { load(); }, [load]);

  const run = async (q) => { const { error } = await q; if (error) throw error; await load(); };
  return {
    rows, loading, error, reload: load,
    insert: (v) => run(supabase.from(table).insert(v)),
    update: (id, v) => run(supabase.from(table).update(v).eq('id', id)),
    remove: (id) => run(supabase.from(table).delete().eq('id', id)),
  };
}