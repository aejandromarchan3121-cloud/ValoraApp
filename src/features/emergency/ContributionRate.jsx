import { useEffect, useState } from 'react';
import { Check, Percent } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import MoneyInput from '../../components/MoneyInput';
import { Button, Card, cx } from '../../components/ui';
import { fmt } from '../../lib/money';

export const MAX_PCT = 50; // tope de seguridad del flujo de caja (la BD admite hasta 100)
const PRESETS = [0, 5, 10, 15, 20];

/** % de cada ingreso que se aparta solo hacia el fondo (lo aplica un trigger en la BD). */
export default function ContributionRate({ fund, onSaved }) {
  const { user } = useAuth();
  const saved = Number(fund?.contribution_pct ?? 0);
  const [pct, setPct] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  useEffect(() => { setPct(saved); }, [saved]);
  const exact = Math.round(pct * 100) / 100;
  const dirty = Math.abs(exact - saved) > 0.001;

  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('emergency_fund')
      .upsert({ user_id: user.id, contribution_pct: exact }, { onConflict: 'user_id' });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: 'No se pudo guardar. Inténtalo de nuevo.' });
    setMsg({ ok: true, text: exact > 0 ? `Listo: apartarás ${exact} % de cada ingreso.` : 'Aporte automático desactivado.' });
    onSaved?.();
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium"><Percent size={16} className="text-brand-500" /> Aporte automático</p>
          <p className="text-xs text-zinc-500">Porcentaje de cada ingreso que se aparta hacia tu fondo.</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{exact.toLocaleString('es-VE')}<span className="text-lg text-zinc-500"> %</span></p>
      </div>

      <div className="flex items-center gap-4">
        <input type="range" min={0} max={MAX_PCT} step={0.5} value={Math.min(pct, MAX_PCT)}
          onChange={(e) => setPct(Number(e.target.value))} aria-label="Porcentaje de aporte automático"
          className="range-brand flex-1" style={{ '--p': `${(Math.min(pct, MAX_PCT) / MAX_PCT) * 100}%` }} />
        <div className="flex items-center gap-1.5">
          <MoneyInput value={pct} onChange={(n) => setPct(n)} decimals={2} max={MAX_PCT}
            className="w-24 text-right" aria-label="Porcentaje exacto" />
          <span className="text-sm text-zinc-500">%</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setPct(p)}
            className={cx('rounded-full border px-3 py-1 text-xs transition-colors',
              exact === p ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300')}>
            {p === 0 ? 'Desactivar' : `${p} %`}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-indigo-50 p-3 text-xs dark:bg-indigo-950/30">
        De cada <b>{fmt(100)}</b> que ingreses se apartan <b>{fmt(exact)}</b>; de <b>{fmt(1000)}</b>, <b>{fmt(exact * 10)}</b>.
        <span className="block pt-1 text-zinc-500">
          Aplica a los ingresos que registres desde ahora (USD o con equivalente en USD) y no cambia los anteriores.
          Es un apartado contable: tu dinero sigue en tu caja. Máximo {MAX_PCT} %.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar porcentaje'}</Button>
        {dirty && <Button variant="ghost" onClick={() => setPct(saved)} disabled={busy}>Descartar</Button>}
        {msg && <span role="status" className={cx('flex items-center gap-1 text-sm', msg.ok ? 'text-emerald-500' : 'text-red-500')}>{msg.ok && <Check size={14} />}{msg.text}</span>}
      </div>
    </Card>
  );
}
