import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlanProvider } from './context/PlanContext';
import { useRatesContext } from './context/RatesContext';
import { supabase } from './supabase';
import { useTable } from './hooks/useTable';
import AuthScreen from './components/auth/AuthScreen';
import AppShell from './components/Layout/AppShell';
import UpgradeGate from './components/UpgradeGate';
import RateComparator from './features/rates/RateComparator';
import CashPanel from './features/cash/CashPanel';
import Inventory from './features/inventory/Inventory';
import EmergencyFund from './features/emergency/EmergencyFund';
import AiAgent from './features/ai/AiAgent';
import Analytics from './features/analytics/Analytics';
import WalletDashboard from './features/wallet/WalletDashboard';


function Dashboard() {
  const [view, setView] = useState('rates');
  const rates = useRatesContext();
  const cashTable = useTable('cash_entries');
  const [fund, setFund] = useState(null);

  const loadFund = useCallback(async () => {
    const { data } = await supabase.from('emergency_fund').select('*').maybeSingle();
    setFund(data);
  }, []);
  
  useEffect(() => { loadFund(); }, [loadFund]);

  // Caja se refresca sola cuando el backend acredita un depósito (Realtime)
  useEffect(() => {
    const ch = supabase.channel('cash-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_entries' }, () => cashTable.reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell view={view} setView={setView}>
      {view === 'rates' && <RateComparator rates={rates} />}
      {view === 'cash' && <CashPanel rates={rates} table={cashTable} />}
      {view === 'wallet' && (
        <UpgradeGate feature="wallet" title="La billetera USDC">
          <WalletDashboard />
        </UpgradeGate>
      )}
      {view === 'inventory' && <Inventory rates={rates} />}
      {view === 'emergency' && (
        <UpgradeGate feature="emergency" title="El fondo de emergencia">
          <EmergencyFund fund={fund} reloadFund={loadFund} />
        </UpgradeGate>
      )}
      {view === 'ai' && (
        <UpgradeGate feature="ai" title="El asistente IA">
          <AiAgent rates={rates} cashTable={cashTable} fund={fund} />
        </UpgradeGate>
      )}
      {view === 'analytics' && (
        <UpgradeGate feature="analytics" title="Las analíticas profundas">
          <Analytics rates={rates} cashTable={cashTable} />
        </UpgradeGate>
      )}
    </AppShell>
  );
}

function Gate() {
  const { session } = useAuth();
  if (session === undefined) return <div className="grid min-h-screen place-items-center text-sm text-zinc-500">Cargando…</div>;
  if (!session) return <AuthScreen />;
  return <PlanProvider><Dashboard /></PlanProvider>;
}

export default function App() {
  return <AuthProvider><Gate /></AuthProvider>;
}