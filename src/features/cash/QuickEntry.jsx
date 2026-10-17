import { useEffect, useMemo, useRef, useState } from 'react';
import { categorize } from '../ai/localAssistant';
import { allocateSale } from '../../lib/emergency';

const METHODS = [
  { id: 'cash_usd', label: 'Efectivo USD', kind: 'efectivo', currency: 'USD' },
  { id: 'cash_bs',  label: 'Efectivo Bs',  kind: 'efectivo', currency: 'VES' },
  { id: 'pagomovil', label: 'Pago Móvil',  kind: 'digital',  currency: 'VES' },
  { id: 'zelle',    label: 'Zelle',        kind: 'digital',  currency: 'USD' },
  { id: 'nequi',    label: 'Nequi',        kind: 'digital',  currency: 'COP' },
  { id: 'bancolombia', label: 'Bancolombia', kind: 'digital', currency: 'COP' },
];

/**
 * Registro rápido. Atajos: Alt+1..6 método · "/" foco en monto · Enter registra.
 * onSubmit({ kind, method, currency, amount, note, category, emergency }) -> conéctalo a TU insert actual.
 * usdRate: tasa Bs por USD (P2P) para estimar el aporte al fondo en ventas en Bs.
 */
export default function QuickEntry({ onSubmit, emergencyPct = 0, usdRate = null }) {
  const [method, setMethod] = useState(METHODS[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const amountRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); setMethod(METHODS[+e.key - 1]); amountRef.current?.focus(); }
      else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); amountRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const num = parseFloat(String(amount).replace(',', '.'));
  const valid = num > 0;
  const category = useMemo(() => categorize(note).category, [note]);
  const usdEq = valid ? (method.currency === 'USD' ? num : usdRate && method.currency === 'VES' ? num / usdRate : null) : null;
  const split = usdEq ? allocateSale(usdEq, emergencyPct) : null;

  const submit = () => {
    if (!valid) return;
    onSubmit({ kind: method.kind, method: method.id, currency: method.currency, amount: num, note: note.trim(), category, emergency: split });
    setAmount(''); setNote(''); amountRef.current?.focus();
  };

  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {METHODS.map((m, i) => (
          <button key={m.id} type="button" onClick={() => { setMethod(m); amountRef.current?.focus(); }}
            className={`chip ${m.id === method.id ? 'chip-active' : ''}`} title={`Alt+${i + 1}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <div className="relative">
          <input ref={amountRef} inputMode="decimal" className="glass-input pr-14" placeholder="Monto" value={amount}
            onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{method.currency}</span>
        </div>
        <input className="glass-input" placeholder="Nota (se autocategoriza)" value={note}
          onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn-primary" onClick={submit} disabled={!valid}>Registrar</button>
      </div>

      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
        {note && <span>Categoría: <b className="text-zinc-300">{category}</b></span>}
        {split && emergencyPct > 0 && <span>Al fondo: <b className="text-emerald-400">USD {split.toFund.toFixed(2)}</b></span>}
        <span className="ml-auto hidden sm:inline">Alt+1…6 método · / monto · Enter registrar</span>
      </p>
    </section>
  );
}
