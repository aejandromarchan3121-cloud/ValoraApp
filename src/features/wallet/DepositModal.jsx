import { useState } from 'react';
import { QrCode, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui';

export default function DepositModal({ open, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [payData, setPayData] = useState(null);

  if (!open) return null;

  const handleGenerateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Usar la variable de entorno de Vite o la URL directa de Render como respaldo
      const API_URL = import.meta.env.VITE_API_URL || 'https://valora-backend-mczw.onrender.com';
      
      const res = await fetch(`${API_URL}/api/deposits/create-binance-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Error al generar la orden');

      setPayData(data);
    } catch (err) {
      console.error('Error generando orden:', err);
      alert(err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPayData(null);
    setAmount('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="font-semibold text-lg">Depositar / Recargar</h3>
          <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>

        {!payData ? (
          <form onSubmit={handleGenerateOrder} className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1">
                Monto a depositar (USDT / USDC)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-700 bg-zinc-950 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100"
                required
              />
            </div>

            <Button disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Generar QR de Binance Pay'}
            </Button>
          </form>
        ) : (
          <div className="mt-4 text-center space-y-4">
            <p className="text-xs text-zinc-400">Escanea con tu app de Binance para realizar el pago:</p>
            
            <div className="flex justify-center p-3 bg-white rounded-xl border border-zinc-200 w-fit mx-auto">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payData.qrCodeUrl)}`} 
                alt="QR Binance Pay" 
              />
            </div>

            <a
              href={payData.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 hover:underline"
            >
              Abrir directo en Binance App <ExternalLink size={14} />
            </a>

            <Button onClick={() => { handleClose(); if (onDone) onDone(); }} className="w-full mt-2">
              Volver a la Billetera
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}