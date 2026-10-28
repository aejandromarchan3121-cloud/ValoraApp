import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CreditCard, Globe, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { useWallet } from '../../hooks/useWallet';
import { num } from '../../lib/money';
import OnRampModal from './OnRampModal';
import ReceiveModal from './ReceiveModal';
import SendModal from './SendModal';
import WithdrawModal from './WithdrawModal';
import TxList from './TxList';
import CardTopUpModal from './CardTopUpModal';

const SANDBOX_TOPUP = import.meta.env.VITE_SANDBOX_TOPUP === 'true';

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
  const [modal, setModal] = useState(null); // receive | onramp | send | withdraw | card
  const balance = Number(wallet?.usdc_balance ?? 0);
  const close = () => setModal(null);

  if (loading) return <p className="text-sm text-zinc-500">Cargando billetera…</p>;
  if (!wallet) return <p className="text-sm text-red-500">No se encontró tu billetera. Ejecuta la migración SQL y vuelve a entrar.</p>;

  return (
    <div className="space-y-5">
      <PageHeader title="Billetera" subtitle="Dólares digitales (USDC) para enviar, recibir y retirar."
        action={profile?.username && <Badge tone="brand">@{profile.username}</Badge>} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {wallet.status !== 'ACTIVE' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">Tu billetera está {wallet.status === 'FROZEN' ? 'congelada' : 'cerrada'}. Contacta a soporte.</p>}
      {!profile?.username && <UsernameSetup userId={userId} onDone={reload} />}

      <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Saldo disponible</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{num(balance)} <span className="text-lg text-zinc-500">USDC</span></p>
        <p className="mt-1 text-xs text-zinc-500">≈ {num(balance)} USD · tu saldo también se refleja en Caja</p>
      </Card>

      <div className={`grid grid-cols-2 gap-3 ${SANDBOX_TOPUP ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <Action icon={ArrowDownToLine} label="Recibir de EE. UU." onClick={() => setModal('receive')} />
        <Action icon={Globe} label="Enviar desde EE. UU." onClick={() => setModal('onramp')} />
        <Action icon={Send} label="Enviar @usuario" onClick={() => setModal('send')} />
        <Action icon={ArrowUpFromLine} label="Retirar a Binance" onClick={() => setModal('withdraw')} />
        {SANDBOX_TOPUP && <Action icon={CreditCard} label="Recargar con tarjeta" onClick={() => setModal('card')} />}
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium">Movimientos recientes</p>
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
