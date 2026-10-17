import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { hasFeature } from '../lib/plans';

const PlanCtx = createContext({ plan: 'lite', can: () => false });
export const usePlan = () => useContext(PlanCtx);

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!user) return setProfile(null);
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
  }, [user]);

  const plan = profile?.plan ?? 'lite';
  return (
    <PlanCtx.Provider value={{ plan, profile, can: (f) => hasFeature(plan, f) }}>
      {children}
    </PlanCtx.Provider>
  );
}