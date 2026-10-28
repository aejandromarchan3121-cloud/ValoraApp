import { useEffect, useState, useCallback } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CreditCard, Globe, Send } from 'lucide-react';
import { supabase } from '../../supabase';
import { Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { num } from '../../lib/money';
import OnRampModal from './OnRampModal';
import ReceiveModal from './ReceiveModal';
import SendModal from './SendModal';
import WithdrawModal from './WithdrawModal';
import TxList from './TxList';
import CardTopUpModal from './CardTopUpModal';

const SANDBOX_TOPUP = import.meta.env.VITE_SANDBOX_TOPUP === 'true';

export default function WalletDashboard() {
  const [wallet, setWallet] = useState(null);
  const [profile, setProfile] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [modal, setModal] = useState(null);

  const loadWalletData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("No hay sesión activa.");

      setUserId(user.id);

      const [wRes, pRes, tRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(30)
      ]);

      if (wRes.error) throw wRes.error;

      setWallet(wRes.data);
      setProfile(pRes.data);
      setTxs(tRes.data ?? []);
    } catch (err) {
      console.error("Error al cargar la billetera:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const balance = Number(wallet?.usdc_balance ?? 0);
  const close = () => setModal(null);

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p className="text-sm font-medium">Cargando Billetera Segura...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500 text-red-200 space-y-3">
        <p className="font-bold">Error de seguridad / carga:</p>
        <p className="text-xs">{error}</p>
        <Button onClick={loadWalletData}>Reintentar conexión</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Billetera" 
        subtitle="Dólares digitales (USDC) para enviar, recibir y retirar con total seguridad."
        action={
          <div className="flex gap-2 items-center">
            {profile?.username && <Badge tone="brand">@{profile.username}</Badge>}
            <Button variant="ghost" onClick={loadWalletData} className="text-xs">🔄 Actualizar</Button>
          </div>
        } 
      />

      {wallet?.status !== 'ACTIVE' && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          Su billetera se encuentra inactiva o restringida. Contacte a soporte.
        </p>
      )}

      <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Saldo Disponible</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">
          {num(balance)} <span className="text-lg text-zinc-500">USDC</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">Equivalente a {num(balance)} USD</p>
      </Card>

      <div className={`grid grid-cols-2 gap-3 ${SANDBOX_TOPUP ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <Action icon={ArrowDownToLine} label="Recibir" onClick={() => setModal('receive')} />
        <Action icon={Globe} label="On-Ramp" onClick={() => setModal('onramp')} />
        <Action icon={Send} label="Enviar" onClick={() => setModal('send')} />
        <Action icon={ArrowUpFromLine} label="Retirar" onClick={() => setModal('withdraw')} />
        {SANDBOX_TOPUP && <Action icon={CreditCard} label="Tarjeta" onClick={() => setModal('card')} />}
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium">Movimientos Recientes</p>
        <TxList txs={txs} userId={userId} />
      </Card>

      <ReceiveModal open={modal === 'receive'} onClose={close} username={profile?.username} />
      <OnRampModal open={modal === 'onramp'} onClose={close} onDone={loadWalletData} />
      <SendModal open={modal === 'send'} onClose={close} onDone={loadWalletData} balance={balance} />
      <CardTopUpModal open={modal === 'card'} onClose={close} onSuccess={loadWalletData} />
      <WithdrawModal open={modal === 'withdraw'} onClose={close} onDone={loadWalletData} balance={balance} />
    </div>
  );
}

const Action = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick}
    className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 dark:border-zinc-800 dark:bg-zinc-900/70">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500/10 text-brand-500"><Icon size={18} /></span>
    {label}
  </button>
);