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
import { useState, useEffect } from 'react';
import BusinessTermsModal from '../../components/legal/BusinessTermsModal';
import { supabase } from './supabase'; // Ajusta la ruta según tu cliente de Supabase

export default function WalletDashboard() {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    checkBusinessProfile();
  }, []);

  // 1. Verificar si el comercio ya aceptó los términos legales
  const checkBusinessProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('terms_accepted_at, company_name, tax_id')
        .eq('id', user.id)
        .single();

      // Si no existe la fecha de aceptación, forzar la aparición del modal
      if (profile && !profile.terms_accepted_at) {
        setShowTermsModal(true);
      }
    } catch (err) {
      console.error('Error verificando estatus KYB del comercio:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // 2. Registrar la aceptación legal en Supabase
  const handleAcceptTerms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      // Cerrar el modal una vez guardado con éxito
      setShowTermsModal(false);
    } catch (err) {
      console.error('Error al guardar la aceptación de términos:', err);
      alert('Hubo un error al registrar el acuerdo. Intenta de nuevo.');
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-sm animate-pulse">Cargando entorno seguro B2B...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      
      {/* Modal de Términos Comerciales B2B Obligatorio */}
      <BusinessTermsModal 
        open={showTermsModal} 
        onAccept={handleAcceptTerms} 
      />

      {/* Encabezado y contenido de la Billetera */}
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold">ValoraApp B2B Portal</h1>
          <p className="text-xs text-zinc-400">Infraestructura de pagos y liquidez corporativa</p>
        </div>
      </header>

      {/* Resto de tu panel de transacciones, botones de depósito, etc. */}
      <div className="grid gap-4">
        {/* Aquí va tu WalletDashboard actual */}
      </div>

    </div>
  );
}

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