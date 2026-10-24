import { useState } from 'react';
import { QrCode, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui';
  
export default function DepositModal({ open, onClose, onDone }) {
  const [tab, setTab] = useState('binance'); // 'binance' | 'fiat'
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleBinanceDeposit = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://valora-backend-mczw.onrender.com/api/deposits/create-binance-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      });
      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Redirigir a Binance Pay
      }
    } catch (err) {
      console.error("Error generando orden:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold">Depositar / Recargar Saldo</h3>
        
        {/* Selector de método de depósito */}
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
          <button 
            onClick={() => setTab('binance')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'binance' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
          >
            Binance Pay
          </button>
          <button 
            onClick={() => setTab('fiat')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${tab === 'fiat' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-500'}`}
          >
            Fiat Local (Bs. / COP)
          </button>
        </div>

        {tab === 'binance' ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Recarga instantánea en USDC usando saldo o pasarela de Binance Pay.</p>
            <Input 
              placeholder="Monto en USD (Ej. 50)" 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button onClick={handleBinanceDeposit} disabled={loading || !amount} className="w-full">
              {loading ? 'Generando orden...' : 'Continuar con Binance Pay'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Realiza una transferencia bancaria nacional para acreditar USDC a tu caja B2B.</p>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-xs space-y-1">
              <p className="font-semibold">Datos bancarios (Venezuela / Colombia):</p>
              <p className="text-zinc-400">Banco: Cuenta Coorporativa Valora</p>
              <p className="text-zinc-400">Ref / Pago Móvil: Consultar tasa en sección Tasas.</p>
            </div>
            <Button onClick={() => alert('Reporte de pago fiat enviado a verificación.')} className="w-full">
              Reportar Pago Fiat Realizado
            </Button>
          </div>
        )}

        <button onClick={onClose} className="w-full text-center text-xs text-zinc-500 hover:underline mt-2">
          Cancelar y cerrar
        </button>
      </div>
    </div>
  );
}