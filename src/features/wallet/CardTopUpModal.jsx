import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { supabase } from '../../supabase';
import { num } from '../../lib/money';

// Opciones de pago y divisas
const PAYMENT_METHODS = [
  { id: 'BS', name: 'Bolívares (Bs)', currency: 'VES', rate: 36.5, symbol: 'Bs', icon: '🇻🇪', type: 'fiat' },
  { id: 'USD', name: 'Dólares (USD)', currency: 'USD', rate: 1.0, symbol: '$', icon: '🇺🇸', type: 'fiat' },
  { id: 'COP', name: 'Pesos Colombianos (COP)', currency: 'COP', rate: 3900, symbol: '$', icon: '🇨🇴', type: 'fiat' },
  { id: 'CRYPTO', name: 'Billetera Cripto (USDT / USDC)', currency: 'USDT', rate: 1.0, symbol: '₮', icon: '⚡', type: 'crypto' },
];

export default function CardTopUpModal({ open, onClose, onSuccess }) {
  const [monto, setMonto] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  // Cálculo del equivalente a recibir en USDC/USD
  const amountNumeric = Number(monto) || 0;
  const montoUsdc = selectedMethod.rate ? amountNumeric / selectedMethod.rate : 0;

  const handleRecarga = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      // Se envían 'amount' y 'currency' para solucionar la restricción NOT NULL de la DB
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amountNumeric,                          // Campo 'amount' requerido por Supabase
        currency: selectedMethod.currency,             // Campo 'currency' requerido por Supabase
        transaction_type: `DEPOSIT_${selectedMethod.id}`,
        amount_bs: selectedMethod.id === 'BS' ? amountNumeric : null,
        amount_usdc: montoUsdc,
        status: 'PENDING_VERIFICATION'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all">
      <Card className="w-full max-w-lg bg-zinc-950/90 border border-zinc-800/80 p-6 sm:p-8 rounded-3xl text-white shadow-2xl space-y-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Recargar Saldo
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Selecciona tu método de pago y convierte a saldo digital.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleRecarga} className="space-y-5">
          
          {/* Panel Desplegable de Selección de Método de Pago / Divisa */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block">
              Método de Pago / Moneda
            </label>
            <div className="relative">
              <select
                value={selectedMethod.id}
                onChange={(e) => {
                  const method = PAYMENT_METHODS.find(m => m.id === e.target.value);
                  setSelectedMethod(method);
                }}
                className="w-full appearance-none rounded-2xl bg-zinc-900/90 border border-zinc-800 px-4 py-3.5 pr-10 text-white font-medium text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id} className="bg-zinc-900 text-white">
                    {method.icon} {method.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Campo de Ingreso de Monto */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block">
              Monto a Pagar ({selectedMethod.symbol})
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="any"
                placeholder="0.00" 
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 pl-4 pr-16 text-white text-lg font-semibold placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition tabular-nums"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                {selectedMethod.currency}
              </span>
            </div>
          </div>

          {/* Tarjeta de Resumen de Conversión */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 p-4 border border-indigo-500/20 text-sm flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400">Recibirás estimado:</span>
              <span className="font-bold text-emerald-400 text-lg tabular-nums">
                {num(montoUsdc)} USDC
              </span>
            </div>
            {selectedMethod.rate !== 1 && (
              <span className="text-xs text-zinc-500 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-zinc-800">
                Tasa: 1 USD ≈ {selectedMethod.rate} {selectedMethod.currency}
              </span>
            )}
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300">
              ⚠️ {error}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="w-full sm:w-auto text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl py-3"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl py-3 px-6 transition-all shadow-lg shadow-indigo-600/25"
            >
              {loading ? 'Procesando...' : `Confirmar ${monto ? `${monto} ${selectedMethod.currency}` : ''}`}
            </Button>
          </div>

        </form>
      </Card>
    </div>
  );
}