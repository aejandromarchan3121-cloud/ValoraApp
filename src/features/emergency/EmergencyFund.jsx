import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import MoneyInput from '../../components/MoneyInput';
import { Button, Card, PageHeader, Stat } from '../../components/ui';
import { fmt, pct } from '../../lib/money';
import ContributionRate from './ContributionRate';

export function fundHealth(fund) {
  const ratio = fund && fund.target_usd ? fund.balance_usd / fund.target_usd : 0;
  if (ratio >= 1) return { ratio, label: 'Saludable', bar: 'bg-emerald-500', text: 'text-emerald-500' };
  if (ratio >= 0.6) return { ratio, label: 'Estable', bar: 'bg-lime-500', text: 'text-lime-500' };
  if (ratio >= 0.25) return { ratio, label: 'En riesgo', bar: 'bg-amber-500', text: 'text-amber-500' };
  return { ratio, label: 'Crítico', bar: 'bg-red-500', text: 'text-red-500' };
}

export default function EmergencyFund({ fund, reloadFund }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(0);
  const [target, setTarget] = useState(Number(fund?.target_usd ?? 1000));
  const [error, setError] = useState(null);
  useEffect(() => { if (fund) setTarget(Number(fund.target_usd)); }, [fund]);

  const h = fundHealth(fund);
  const run = async (promise) => {
    setError(null);
    const { error: e } = await promise;
    if (e) setError('No se pudo guardar el cambio.'); else reloadFund();
  };
  // Aportes RELATIVOS en la BD: no pisan lo que el aporte automático sumó entre tanto.
  const move = async (sign) => {
    if (!amount) return;
    await run(supabase.rpc('adjust_emergency_fund', { p_delta: sign * amount }));
    setAmount(0);
  };
  const saveTarget = () => run(supabase.from('emergency_fund')
    .upsert({ user_id: user.id, target_usd: target }, { onConflict: 'user_id' }));

  return (
    <div className="space-y-5">
      <PageHeader title="Fondo de liquidez de emergencia" subtitle="Tu colchón en USD frente a imprevistos y devaluación." />
      {h.ratio < 0.25 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <AlertTriangle size={16} /> Reserva por debajo del 25% de tu meta. Prioriza aportar a este fondo.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Reserva (USDT/USD)" value={fmt(fund?.balance_usd ?? 0)} />
        <Stat label="Meta" value={fmt(fund?.target_usd ?? 1000)} />
        <Stat label="Estado" value={h.label} tone={h.text} hint={pct(h.ratio * 100)} />
      </div>

      <ContributionRate fund={fund} onSaved={reloadFund} />

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm"><ShieldCheck size={16} className={h.text} /> Salud del fondo</div>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className={`h-full rounded-full transition-all duration-700 ${h.bar}`} style={{ width: `${Math.min(100, h.ratio * 100)}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MoneyInput className="max-w-[10rem]" placeholder="Monto USD" value={amount} onChange={setAmount} aria-label="Monto a mover" />
          <Button onClick={() => move(1)} disabled={!amount}>Aportar</Button>
          <Button variant="ghost" onClick={() => move(-1)} disabled={!amount}>Retirar</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          Meta (USD):
          <MoneyInput className="max-w-[10rem]" value={target} onChange={setTarget} aria-label="Meta del fondo" />
          <Button variant="ghost" onClick={saveTarget} disabled={!target}>Guardar meta</Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </Card>
    </div>
  );
}
