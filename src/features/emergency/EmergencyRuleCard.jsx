import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import { useEmergencyRule } from '../../hooks/useEmergencyRule';
import { allocateSale } from '../../lib/emergency';
import { glass } from '../../lib/glass';
import { fmt } from '../../lib/money';

/** Ponlo dentro de tu panel de Emergencia (p. ej. justo debajo de "Salud del fondo"). */
export default function EmergencyRuleCard() {
  const { pct, setPct, save, loading, saving } = useEmergencyRule();
  const [saved, setSaved] = useState(false);
  const demo = allocateSale(100, pct);
  const change = (v) => { setSaved(false); setPct(Math.min(100, Math.max(0, +v || 0))); };

  return (
    <Card className={`space-y-4 ${glass}`}>
      <h3 className="flex items-center gap-2 font-medium"><ShieldCheck size={18} className="text-emerald-500" /> Aporte automático por venta</h3>
      <div className="flex items-center gap-4">
        <input type="range" min="0" max="50" value={pct} disabled={loading} onChange={(e) => change(e.target.value)} className="flex-1 accent-indigo-500" />
        <div className="flex w-24 items-center gap-1">
          <Input type="number" min="0" max="100" value={pct} onChange={(e) => change(e.target.value)} />
          <span className="text-zinc-500">%</span>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        De una venta de <b>{fmt(100)}</b> → <b className="text-emerald-500">{fmt(demo.toFund)}</b> al fondo y <b>{fmt(demo.toCash)}</b> a caja.
      </p>
      <Button disabled={saving || loading} onClick={async () => setSaved(await save(pct))}>
        {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar porcentaje'}
      </Button>
    </Card>
  );
}
