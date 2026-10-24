import { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Globe, Send, WalletCards } from 'lucide-react';
import { supabase } from '../../supabase';
import { Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { useWallet } from '../../hooks/useWallet';
import { num } from '../../lib/money';
import OnRampModal from './OnRampModal';
import ReceiveModal from './ReceiveModal';
import SendModal from './SendModal';
import WithdrawModal from './WithdrawModal';
import DepositModal from './DepositModal';
import TxList from './TxList';
import BusinessTermsModal from '../../components/legal/BusinessTermsModal'; // <-- Importamos el modal legal B2B

function UsernameSetup({ userId, onDone }) {
  const [u, setU] = useState('');
  const [err, setErr] = useState(null);
  const valid = /^[a-z0-9_]{3,20}$/.test(u);
  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update({ username: u }).eq('id', userId);
    if (error) setErr(error.code === '23505' ? 'Ese @usuario ya existe.' : 'No se pudo guardar.');
    else onDone();
  };
  
  return (
    
    <Card>
      <p className="font-medium">Elige tu @usuario</p>
      <p className="text-sm text-zinc-500">Así te encontrarán para enviarte dinero. Minúsculas, números y _ (3–20).</p>
      <form onSubmit={save} className="mt-3 flex gap-2">
        <Input placeholder="tu_usuario" value={u} autoCapitalize="none"
          onChange={(e) => { setU(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setErr(null); }} />
        <Button disabled={!valid}>Guardar</Button>
      </form>
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
    </Card>
  );
}

const Action = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick}
    className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/70">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500/10 text-brand-500"><Icon size={18} /></span>
    {label}
  </button>
);

export default function WalletDashboard() {
  const { wallet, profile, txs, loading, error, userId, reload } = useWallet();
  const [modal, setModal] = useState(null); // receive | onramp | send | withdraw | deposit
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  const balance = Number(wallet?.usdc_balance ?? 0);
  const close = () => setModal(null);

// Validar estatus legal B2B de forma estricta
  useEffect(() => {
    if (profile) {
      console.log("Estado actual de terms_accepted_at:", profile.terms_accepted_at);
      if (!profile.terms_accepted_at) {
        setShowTermsModal(true);
      }
    }
  }, [profile]);

  // Manejar la aceptación del contrato comercial B2B
  const handleAcceptTerms = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      setShowTermsModal(false);
      reload(); // Recargar datos para refrescar el perfil
    } catch (err) {
      console.error('Error al registrar aceptación de términos:', err);
      alert('No se pudo registrar el acuerdo. Intenta de nuevo.');
    }
  };

  if (loading) return <p className="text-sm text-zinc-500">Cargando billetera…</p>;
  if (!wallet) return <p className="text-sm text-red-500">No se encontró tu billetera. Ejecuta la migración SQL y vuelve a entrar.</p>;

return (
    <div className="space-y-5 relative">
      
      {/* Forzar renderizado directo si showTermsModal es true */}
      <BusinessTermsModal 
        open={showTermsModal} 
        onAccept={handleAcceptTerms} 
      />

      <PageHeader title="Billetera B2B" subtitle="Liquidez en dólares digitales (USDC) para comercios y empresas."
        action={profile?.username && <Badge tone="brand">@{profile.username}</Badge>} />
      
      {error && <p className="text-sm text-red-500">{error}</p>}
      {wallet.status !== 'ACTIVE' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">Tu billetera está {wallet.status === 'FROZEN' ? 'congelada' : 'cerrada'}. Contacta a soporte.</p>}
      {!profile?.username && <UsernameSetup userId={userId} onDone={reload} />}

      <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Saldo disponible en Caja</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{num(balance)} <span className="text-lg text-zinc-500">USDC</span></p>
        <p className="mt-1 text-xs text-zinc-500">≈ {num(balance)} USD · respaldado bajo infraestructura corporativa</p>
      </Card>

      {/* Botones de acción ampliados (5 opciones distribuidas limpiamente) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Action 
  icon={WalletCards} 
  label="Depositar / Recargar" 
  onClick={() => {
    console.log("Abriendo modal de depósito...");
    setModal('deposit');
  }} 
/>
        <Action icon={ArrowDownToLine} label="Recibir de EE. UU." onClick={() => setModal('receive')} />
        <Action icon={Globe} label="Enviar desde EE. UU." onClick={() => setModal('onramp')} />
        <Action icon={Send} label="Enviar @usuario" onClick={() => setModal('send')} />
        <Action icon={ArrowUpFromLine} label="Retirar a Binance" onClick={() => setModal('withdraw')} />
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium">Movimientos recientes</p>
        <TxList txs={txs} userId={userId} />
      </Card>

     {/* Modales */}
     <DepositModal 
  open={modal === 'deposit'} 
  onClose={() => setModal(null)} 
  onDone={reload} 
/>
      <ReceiveModal open={modal === 'receive'} onClose={close} username={profile?.username} />
      <OnRampModal open={modal === 'onramp'} onClose={close} onDone={reload} />
      <SendModal open={modal === 'send'} onClose={close} onDone={reload} balance={balance} />
      <WithdrawModal open={modal === 'withdraw'} onClose={close} onDone={reload} balance={balance} />
    </div>
  );
}