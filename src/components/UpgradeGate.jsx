import { Lock } from 'lucide-react';
import { Card } from './ui';
import { usePlan } from '../context/PlanContext';

/** Envuelve una vista Full. En Lite muestra la pantalla de upgrade. */
export default function UpgradeGate({ feature, title, children }) {
  const { can } = usePlan();
  if (can(feature)) return children;
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <Lock className="mx-auto mb-3 text-brand-500" />
      <h2 className="text-lg font-semibold">{title} es parte de la versión Full</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Desbloquea IA completa, fondo de emergencia y analíticas profundas con un único pago.
      </p>
    </Card>
  );
}