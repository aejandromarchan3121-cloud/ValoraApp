import { useMemo, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';

/**
 * Props: rates (mismo objeto de RateComparator: {bcv,p2p,loading,error}),
 *        onRegister({ bs, usdt, rate, feePct, lossVsBcvUsd }) -> tu insert en Supabase.
 */
export default function BsToUsdtConverter({ rates, onRegister }) {
  const [bs, setBs] = useState('');
  const [feePct, setFeePct] = useState(0);
  const [done, setDone] = useState(false);

  const p2p = rates?.p2p?.price;
  const bcv = rates?.bcv?.price;
  const ready = !rates?.loading && !rates?.error && p2p > 0 && bcv > 0;
  const amount = parseFloat(String(bs).replace(',', '.')) || 0;

  const calc = useMemo(() => {
    if (!ready || !amount) return null;
    const usdt = (amount / p2p) * (1 - feePct / 100);
    const usdAtBcv = amount / bcv;
    return { usdt, usdAtBcv, loss: usdAtBcv - usdt };
  }, [ready, amount, p2p, bcv, feePct]);

  return (
    <section className="glass-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <ArrowDownUp size={18} className="text-indigo-300" />
        <h3 className="text-sm font-semibold text-zinc-100">Convertir Bs → USDT</h3>
      </header>

      {!ready ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <input inputMode="decimal" className="glass-input" placeholder="Bs a liquidar" value={bs}
              onChange={(e) => { setBs(e.target.value); setDone(false); }} />
            <div className="relative">
              <input type="number" min={0} step="0.1" className="glass-input pr-20" value={feePct}
                onChange={(e) => setFeePct(+e.target.value || 0)} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">% comisión</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <div className="stat-label">Recibes</div>
              <div className="stat-value text-emerald-300">{calc ? calc.usdt.toFixed(2) : '—'} <span className="text-sm">USDT</span></div>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <div className="stat-label">Brecha vs BCV</div>
              <div className="stat-value text-rose-300">{calc ? `-${calc.loss.toFixed(2)}` : '—'} <span className="text-sm">USD</span></div>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Tasa P2P {p2p.toFixed(2)} Bs · BCV {bcv.toFixed(2)} Bs</p>

          <button className="btn-primary mt-4" disabled={!calc}
            onClick={() => { onRegister?.({ bs: amount, usdt: +calc.usdt.toFixed(2), rate: p2p, feePct, lossVsBcvUsd: +calc.loss.toFixed(2) }); setBs(''); setDone(true); }}>
            {done ? 'Registrado ✓' : 'Registrar conversión'}
          </button>
        </>
      )}
    </section>
  );
}
