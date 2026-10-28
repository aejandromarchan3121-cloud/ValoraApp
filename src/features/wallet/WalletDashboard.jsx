import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CreditCard, Globe, Send, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { useWallet } from '../../hooks/useWallet';
import { num } from '../../lib/money';
import OnRampModal from './OnRampModal';
import ReceiveModal from './ReceiveModal';
import SendModal from './SendModal';
import WithdrawModal from './WithdrawModal';
import TxList from './TxList';
import CardTopUpModal from './CardTopUpModal';

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
    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 hover:shadow-lg active:scale-95">
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-zinc-100">
      <Icon size={20} />
    </span>
    <span className="text-center">{label}</span>
  </button>
);

export default function WalletDashboard() {
  const { wallet, profile, txs, loading, error, userId, reload } = useWallet();
  const [modal, setModal] = useState(null);
  const balance = Number(wallet?.usdc_balance ?? 0);
  const close = () => setModal(null);

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-900 text-zinc-400 text-center border border-zinc-800">
        <p className="text-lg font-medium">Cargando billetera…</p>
        <p className="text-xs text-zinc-500 mt-1">ID de usuario: {userId || 'Buscando...'}</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/50 text-red-200 space-y-2">
        <p className="font-bold">⚠️ No se encontró tu billetera en Supabase</p>
        <p className="text-xs text-zinc-400">Usuario ID: {userId}</p>
        <p className="text-xs text-zinc-400">Error técnico: {error || 'La tabla wallets no devolvió registros para este user_id.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Billetera" 
        subtitle="Dólares digitales (USDC) para enviar, recibir y retirar."
        action={profile?.username && <Badge tone="brand">@{profile.username}</Badge>} 
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
      
      {wallet.status !== 'ACTIVE' && (
        <p className="rounded-xl bg-red-950/40 border border-red-500/30 p-3 text-sm text-red-300">
          Tu billetera está {wallet.status === 'FROZEN' ? 'congelada' : 'cerrada'}. Contacta a soporte.
        </p>
      )}

      {!profile?.username && <UsernameSetup userId={userId} onDone={reload} />}

      <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Saldo disponible</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-white tabular-nums">
          {num(balance)} <span className="text-lg font-normal text-zinc-400">USDC</span>
        </p>
        <p className="mt-1 text-xs text-zinc-400">≈ {num(balance)} USD · tu saldo también se refleja en Caja</p>
      </Card>

      {/* Los 5 botones de acción organizados idénticos a tu referencia */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Action icon={Download} label="Depositar / Recargar" onClick={() => setModal('card')} />
        <Action icon={ArrowDownToLine} label="Recibir de EE. UU." onClick={() => setModal('receive')} />
        <Action icon={Globe} label="Enviar desde EE. UU." onClick={() => setModal('onramp')} />
        <Action icon={Send} label="Enviar @usuario" onClick={() => setModal('send')} />
        <Action icon={ArrowUpFromLine} label="Retirar a Binance" onClick={() => setModal('withdraw')} />
      </div>

      <Card className="border-zinc-800 bg-zinc-900/40">
        <p className="mb-4 text-sm font-medium text-zinc-200">Movimientos recientes</p>
        <TxList txs={txs} userId={userId} />
      </Card>

      <ReceiveModal open={modal === 'receive'} onClose={close} username={profile?.username} />
      <OnRampModal open={modal === 'onramp'} onClose={close} onDone={reload} />
      <SendModal open={modal === 'send'} onClose={close} onDone={reload} balance={balance} />
      <CardTopUpModal open={modal === 'card'} onClose={close} onSuccess={reload} />
      <WithdrawModal open={modal === 'withdraw'} onClose={close} onDone={reload} balance={balance} />
    </div>
  );
}