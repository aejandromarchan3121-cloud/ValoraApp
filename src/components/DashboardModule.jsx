import { useState } from 'react';

export default function DashboardModule() {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);

  // Sanitizador de entrada para permitir estrictamente formato decimal financiero (ej: 125.50)
  const handleDecimalInput = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d{0,6}$/.test(val)) {
      setAmount(val);
    }
  };

  const handleSendExternal = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/onramp/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'current-user-uuid',
          amount: parseFloat(amount),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.checkout_url) throw new Error('La respuesta no incluye checkout_url');
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error(err);
      alert('Error al procesar la sesión de pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl max-w-md mx-auto mt-6 border border-slate-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-wide text-emerald-400">ValoraApp • Billetera USDC</h2>
        <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-1 rounded-full border border-emerald-800">Red Base / Polygon</span>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl mb-6">
        <p className="text-sm text-slate-400">Saldo Disponible</p>
        <h3 className="text-3xl font-extrabold text-white mt-1">$1,245.80 <span className="text-sm font-normal text-emerald-400">USDC</span></h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Monto a Enviar / Recibir (USD)</label>
          <input 
            type="text" 
            value={amount} 
            onChange={handleDecimalInput} 
            placeholder="0.00" 
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 font-mono text-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Destinatario (@username)</label>
          <input 
            type="text" 
            value={recipient} 
            onChange={(e) => setRecipient(e.target.value)} 
            placeholder="@usuario" 
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button 
          onClick={handleSendExternal}
          disabled={loading || !amount}
          className="w-full bg-emerald-500 hover:bg-emerald-600 transition text-slate-950 font-bold py-3 rounded-lg shadow-lg disabled:opacity-50"
        >
          {loading ? 'Procesando...' : 'Recargar con Tarjeta (EE. UU.)'}
        </button>
      </div>
    </div>
  );
}