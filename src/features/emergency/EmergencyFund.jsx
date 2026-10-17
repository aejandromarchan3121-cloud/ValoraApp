import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabase';
import { Button, Card, Input, Stat } from '../../components/ui';
import { fmt, pct } from '../../lib/money';

export function fundHealth(fund) {
  const ratio = fund && fund.target_usd ? fund.balance_usd / fund.target_usd : 0;
  if (ratio >= 1) return { ratio, label: 'Saludable', bar: 'bg-emerald-500', text: 'text-emerald-500' };
  if (ratio >= 0.6) return { ratio, label: 'Estable', bar: 'bg-lime-500', text: 'text-lime-500' };
  if (ratio >= 0.25) return { ratio, label: 'En riesgo', bar: 'bg-amber-500', text: 'text-amber-500' };
  return { ratio, label: 'Crítico', bar: 'bg-red-500', text: 'text-red-500' };
}

export default function EmergencyFund({ fund, reloadFund }) {
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  useEffect(() => { if (fund) setTarget(fund.target_usd); }, [fund]);

  const h = fundHealth(fund);
  const save = async (balance_usd, target_usd = fund?.target_usd ?? 1000) => {
    await supabase.from('emergency_fund').upsert({ balance_usd, target_usd, updated_at: new Date().toISOString() });
    reloadFund();
  };
  const move = (sign) => {
    const a = +amount; if (!a) return;
    save(Math.max(0, (fund?.balance_usd ?? 0) + sign * a));
    setAmount('');
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Fondo de liquidez de emergencia</h1>
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

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm"><ShieldCheck size={16} className={h.text} /> Salud del fondo</div>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className={`h-full rounded-full transition-all duration-700 ${h.bar}`} style={{ width: `${Math.min(100, h.ratio * 100)}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input className="max-w-[10rem]" type="number" min="0" placeholder="Monto USD" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button onClick={() => move(1)}>Aportar</Button>
          <Button variant="ghost" onClick={() => move(-1)}>Retirar</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          Meta:
          <Input className="max-w-[10rem]" type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} />
          <Button variant="ghost" onClick={() => save(fund?.balance_usd ?? 0, +target)}>Guardar meta</Button>
        </div>
      </Card>
    </div>
  );
}