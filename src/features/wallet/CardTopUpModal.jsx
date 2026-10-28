import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { supabase } from '../../supabase';
import { num } from '../../lib/money';

export default function CardTopUpModal({ open, onClose, onSuccess }) {
  const [montoBs, setMontoBs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tasa de cambio de ejemplo (puedes conectarla con tu contexto de tasas / BCV)
  const tasaBsUsd = 36.5; 
  const montoUsdc = Number(montoBs) ? Number(montoBs) / tasaBsUsd : 0;

  if (!open) return null;

  const handleRecargaBs = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      // Registrar la transacción o recarga en bolívares directamente en Supabase
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'DEPOSIT_BS',
        amount_bs: Number(montoBs),
        amount_usdc: montoUsdc,
        status: 'PENDING_VERIFICATION' // o COMPLETED según tu flujo de pago móvil / transferencia
      });

      if (txError) throw txError;

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 text-white space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-lg font-bold">Recargar saldo con Bolívares (Bs)</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <p className="text-xs text-zinc-400">
          Realiza el pago equivalente y obtén tus dólares digitales (USDC) de forma automática.
        </p>

        <form onSubmit={handleRecargaBs} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Monto a pagar (Bs)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={montoBs}
              onChange={(e) => setMontoBs(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 p-3 text-white focus:outline-none focus:border-indigo-500 tabular-nums"
              required
            />
          </div>

          <div className="rounded-xl bg-zinc-800/50 p-3 border border-zinc-800 text-sm flex justify-between">
            <span className="text-zinc-400">Recibirás aprox:</span>
            <span className="font-semibold text-emerald-400 tabular-nums">{num(montoUsdc)} USDC</span>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Procesando...' : `Confirmar Pago de ${montoBs || 0} Bs`}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}