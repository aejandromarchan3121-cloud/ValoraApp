import { useState, useEffect, useCallback } from 'react';

export default function DashboardModule({ userToken }) {
  // Estados para datos
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  // Estados de interfaz y feedback
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Helper para mostrar notificaciones temporales
  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  };

  // 1. Obtener saldo actual de la API
  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const response = await fetch('/api/v1/wallet/balance', {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('No se pudo obtener el saldo actual.');
      const data = await response.json();
      
      setBalance(data.balance_usdc);
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al sincronizar saldo con la red.');
    } finally {
      setLoadingBalance(false);
    }
  }, [userToken]);

  useEffect(() => {
    if (userToken) {
      fetchBalance();
    }
  }, [userToken, fetchBalance]);

  // Sanitizador de entrada para montos
  const handleDecimalInput = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d{0,6}$/.test(val)) {
      setAmount(val);
    }
  };

  // 2. Proceso: Recargar con Tarjeta (Onramp externo)
  const handleOnrampCheckout = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('error', 'Ingresa un monto válido para recargar.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/onramp/checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parsedAmount,
          currency: 'USD',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.checkout_url) throw new Error('Servicio de pago no devolvió URL de redirección.');

      // Redirección a la pasarela externa (Stripe / MoonPay / Ramp)
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error(err);
      showToast('error', err.message || 'Error al conectar con la pasarela de pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Proceso: Transferencia P2P interna / externa
  const handleSendTransfer = async () => {
    const parsedAmount = parseFloat(amount);
    
    if (!recipient || !recipient.startsWith('@')) {
      showToast('error', 'Ingresa un usuario destinatario válido (ej: @usuario).');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      showToast('error', 'Ingresa un monto válido a enviar.');
      return;
    }

    if (balance !== null && parsedAmount > balance) {
      showToast('error', 'Saldo insuficiente para realizar esta transferencia.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/wallet/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: recipient.replace('@', '').trim(),
          amount: parsedAmount,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Error en la transferencia');
      }

      showToast('success', `¡Enviaste $${parsedAmount} USDC a ${recipient}!`);
      
      // Limpiar formulario y actualizar saldo
      setAmount('');
      setRecipient('');
      await fetchBalance();
    } catch (err) {
      console.error(err);
      showToast('error', err.message || 'Error al procesar la transferencia.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl max-w-md mx-auto mt-6 border border-slate-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold tracking-wide text-emerald-400">ValoraApp • Billetera USDC</h2>
        <span className="text-xs bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-800 font-medium">
          Base / Polygon
        </span>
      </div>

      {/* Tarjeta de Saldo */}
      <div className="bg-slate-800 p-4 rounded-xl mb-6 relative overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-400">Saldo Disponible</p>
          <button 
            onClick={fetchBalance} 
            className="text-xs text-slate-400 hover:text-emerald-400 transition"
            title="Actualizar saldo"
          >
            🔄
          </button>
        </div>
        
        <h3 className="text-3xl font-extrabold text-white mt-1">
          {loadingBalance ? (
            <span className="animate-pulse text-slate-500">Cargando...</span>
          ) : (
            <>
              ${balance !== null ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}{' '}
              <span className="text-sm font-normal text-emerald-400">USDC</span>
            </>
          )}
        </h3>
      </div>

      {/* Alertas / Banner Feedback */}
      {feedback.message && (
        <div className={`p-3 rounded-lg mb-4 text-xs font-semibold ${
          feedback.type === 'error' ? 'bg-rose-950 border border-rose-800 text-rose-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Formulario */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Monto (USD / USDC)</label>
          <input 
            type="text" 
            value={amount} 
            onChange={handleDecimalInput} 
            placeholder="0.00" 
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 font-mono text-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Destinatario <span className="text-slate-500 font-normal">(Solo para envíos P2P)</span>
          </label>
          <input 
            type="text" 
            value={recipient} 
            onChange={(e) => setRecipient(e.target.value)} 
            placeholder="@usuario" 
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Botones de Acción */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button 
            onClick={handleOnrampCheckout}
            disabled={isProcessing || !amount}
            className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold py-3 px-2 rounded-lg transition shadow-lg disabled:opacity-50 text-xs sm:text-sm"
          >
            {isProcessing ? 'Procesando...' : 'Recargar con Tarjeta'}
          </button>

          <button 
            onClick={handleSendTransfer}
            disabled={isProcessing || !amount || !recipient}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-2 rounded-lg transition shadow-lg disabled:opacity-50 text-xs sm:text-sm"
          >
            {isProcessing ? 'Enviando...' : 'Enviar USDC'}
          </button>
        </div>
      </div>
    </div>
  );
}