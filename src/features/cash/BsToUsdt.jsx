import { useMemo, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import { glass } from '../../lib/glass';

const n2 = (x) => x.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** rates = mismo objeto que usa RateComparator. onRegister({ bs, usdt, rate, feePct }) es async. */
export default function BsToUsdt({ rates, onRegister }) {
  const [bs, setBs] = useState('');
  const [fee, setFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const p2p = rates?.p2p?.price, bcv = rates?.bcv?.price;
  const ready = !rates?.loading && p2p > 0 && bcv > 0;
  const amount = parseFloat(String(bs).replace(',', '.')) || 0;

  const calc = useMemo(() => {
    if (!ready || !amount) return null;
    const usdt = (amount / p2p) * (1 - fee / 100);
    return { usdt, loss: amount / bcv - usdt };
  }, [ready, amount, p2p, bcv, fee]);

  const register = async () => {
    setBusy(true);
    try { await onRegister({ bs: amount, usdt: +calc.usdt.toFixed(2), rate: p2p, feePct: fee }); setBs(''); setDone(true); }
    finally { setBusy(false); }
  };

  return (
    <Card className={`space-y-3 ${glass}`}>
      <h2 className="flex items-center gap-2 font-medium"><ArrowRightLeft size={16} className="text-indigo-500" /> Convertir Bs → USDT</h2>
      {!ready ? <div className="h-20 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-white/5" aria-busy="true" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="number" min="0" step="0.01" placeholder="Bs a liquidar" value={bs} onChange={(e) => { setBs(e.target.value); setDone(false); }} />
            <Input type="number" min="0" step="0.1" placeholder="% comisión" value={fee} onChange={(e) => setFee(+e.target.value || 0)} />
            <Button disabled={!calc || busy} onClick={register}>{done ? 'Registrado ✓' : busy ? 'Registrando…' : 'Registrar conversión'}</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-xs text-zinc-500">Recibes</p><p className="text-xl font-semibold tabular-nums text-emerald-500">{calc ? n2(calc.usdt) : '—'} USDT</p></div>
            <div className="rounded-xl bg-red-500/10 p-3"><p className="text-xs text-zinc-500">Brecha vs BCV</p><p className="text-xl font-semibold tabular-nums text-red-500">{calc ? `-${n2(calc.loss)}` : '—'} USD</p></div>
          </div>
          <p className="text-xs text-zinc-500">Tasa P2P {n2(p2p)} Bs · BCV {n2(bcv)} Bs</p>
        </>
      )}
    </Card>
  );
}
