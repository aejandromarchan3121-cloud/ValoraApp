import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { supabase } from '../../supabase';
import { num } from '../../lib/money';

const PAYMENT_METHODS = [
  { id: 'BS', name: 'Bolívares (Bs)', currency: 'VES', rate: 36.5, symbol: 'Bs', icon: '🇻🇪' },
  { id: 'USD', name: 'Dólares (USD)', currency: 'USD', rate: 1.0, symbol: '$', icon: '🇺🇸' },
  { id: 'COP', name: 'Pesos Colombianos (COP)', currency: 'COP', rate: 3900, symbol: '$', icon: '🇨🇴' },
  { id: 'CRYPTO', name: 'Billetera Cripto (USDT / USDC)', currency: 'USDT', rate: 1.0, symbol: '₮', icon: '⚡' },
];

// URL de tu Backend desplegado en Render (ajústala a tu subdominio de Render)
const RENDER_BACKEND_URL = 'https://tu-servicio-en-render.onrender.com';

export default function CardTopUpModal({ open, onClose, onSuccess }) {
  const [monto, setMonto] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0]);
  const [step, setStep] = useState('FORM'); // 'FORM' | 'CONFIRM'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const amountNumeric = Number(monto) || 0;
  const montoUsdc = selectedMethod.rate ? amountNumeric / selectedMethod.rate : 0;

  // Paso 1: Ir a la vista de confirmación
  const handleGoToConfirm = (e) => {
    e.preventDefault();
    if (amountNumeric <= 0) {
      setError("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    setError(null);
    setStep('CONFIRM');
  };

  // Paso 2: Confirmar e invocar la API en Render
  const handleConfirmAndPay = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      // 1. Guardar la orden preliminar en Supabase
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: amountNumeric,
          currency: selectedMethod.currency,
          transaction_type: `DEPOSIT_${selectedMethod.id}`,
          amount_bs: selectedMethod.id === 'BS' ? amountNumeric : null,
          amount_usdc: montoUsdc,
          status: 'PENDING'
        })
        .select()
        .single();

      if (txError) throw txError;

      // 2. Enviar petición a tu Backend en Render para generar la orden en Binance
      const response = await fetch(`${RENDER_BACKEND_URL}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txData.id,
          user_id: user.id,
          amount: amountNumeric,
          currency: selectedMethod.currency,
          monto_usdc: montoUsdc,
          payment_method: selectedMethod.id
        })
      });

      const orderResult = await response.json();
      if (!response.ok) throw new Error(orderResult.message || "Error al generar la orden en el servidor.");

      // 3. Redirigir al usuario al Checkout de Binance o pasarela provista
      if (orderResult.checkoutUrl) {
        window.location.href = orderResult.checkoutUrl;
      } else {
        onSuccess?.();
        handleCloseModal();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setStep('FORM');
    setError(null);
    setMonto('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all">
      <Card className="w-full max-w-lg bg-zinc-950/90 border border-zinc-800/80 p-6 sm:p-8 rounded-3xl text-white shadow-2xl space-y-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {step === 'FORM' ? 'Recargar Saldo' : 'Confirmar Orden'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {step === 'FORM' 
                ? 'Selecciona tu método de pago y monto a ingresar.' 
                : 'Verifica los detalles antes de procesar el pago.'}
            </p>
          </div>
          <button 
            onClick={handleCloseModal} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* PASO 1: Formulario de Selección */}
        {step === 'FORM' && (
          <form onSubmit={handleGoToConfirm} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block">
                Método de Pago / Moneda
              </label>
              <select
                value={selectedMethod.id}
                onChange={(e) => setSelectedMethod(PAYMENT_METHODS.find(m => m.id === e.target.value))}
                className="w-full appearance-none rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3.5 text-white font-medium text-sm focus:outline-none focus:border-indigo-500 transition cursor-pointer"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.icon} {method.name}
                  </option>
                ))}
              </select>
            </div>

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
                  className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 p-4 pl-4 pr-16 text-white text-lg font-semibold placeholder-zinc-600 focus:outline-none focus:border-indigo-500 tabular-nums"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                  {selectedMethod.currency}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-indigo-950/20 p-4 border border-indigo-500/20 text-sm flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-400">Recibirás aprox:</span>
                <span className="font-bold text-emerald-400 text-lg tabular-nums">
                  {num(montoUsdc)} USDC
                </span>
              </div>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300">⚠️ {error}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleCloseModal} className="text-zinc-400">Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3 px-6">
                Continuar
              </Button>
            </div>
          </form>
        )}

        {/* PASO 2: Resumen de Confirmación antes de enviar a Render */}
        {step === 'CONFIRM' && (
          <div className="space-y-5">
            <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-zinc-400">Método de pago:</span>
                <span className="font-semibold">{selectedMethod.icon} {selectedMethod.name}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-zinc-400">Monto a depositar:</span>
                <span className="font-semibold text-white tabular-nums">{monto} {selectedMethod.currency}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-zinc-400">Tasa aplicada:</span>
                <span className="text-zinc-300 tabular-nums">1 USD ≈ {selectedMethod.rate} {selectedMethod.currency}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-zinc-400">Monto final acreditable:</span>
                <span className="font-bold text-emerald-400 text-base tabular-nums">{num(montoUsdc)} USDC</span>
              </div>
            </div>

            {error && <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-xs text-red-300">⚠️ {error}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('FORM')} disabled={loading} className="text-zinc-400">
                Atrás
              </Button>
              <Button 
                type="button" 
                onClick={handleConfirmAndPay}
                disabled={loading}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl py-3 px-6 shadow-lg shadow-emerald-600/20"
              >
                {loading ? 'Generando Pago...' : 'Pagar Ahora'}
              </Button>
            </div>
          </div>
        )}

      </Card>
    </div>
  );
}