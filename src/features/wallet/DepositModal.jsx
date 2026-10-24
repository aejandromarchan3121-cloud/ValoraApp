import React, { useState } from 'react';

export default function DepositModal({ isOpen, onClose, onRegisterDeposit }) {
  const [method, setMethod] = useState('pago_movil'); // 'pago_movil', 'banco_ve', 'nequi', 'bancolombia', 'crypto'
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Datos bancarios configurados de la plataforma para recibir fondos
  const paymentDetails = {
    pago_movil: {
      title: "Pago Móvil (Venezuela)",
      banco: "0102 - Banco de Venezuela",
      cedula: "V-26.123.456",
      telefono: "0412-1234567",
    },
    banco_ve: {
      title: "Transferencia Bancaria (Venezuela)",
      banco: "0102 - Banco de Venezuela",
      cuenta: "0102-0000-00-0000000000",
      titular: "ValoraApp C.A.",
      rif: "J-50000000-0"
    },
    nequi: {
      title: "Nequi (Colombia)",
      numero: "300 123 4567",
      titular: "ValoraApp CO"
    },
    bancolombia: {
      title: "Bancolombia",
      cuenta: "123-456789-01 (Ahorros)",
      titular: "ValoraApp CO",
      nit: "900.123.456-1"
    },
    crypto: {
      title: "Criptomonedas (USDT / USDC)",
      polygon: "0x1234...PolygonAddressExample",
      base: "0x5678...BaseAddressExample"
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();
    setLoading(true);

    // Enviar el reporte de depósito al backend para validación
    setTimeout(() => {
      setLoading(false);
      if (onRegisterDeposit) {
        onRegisterDeposit({ method, amount: Number(amount), reference });
      }
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#121620] border border-gray-800 rounded-2xl p-6 w-full max-w-lg text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Depositar Fondos</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-lg">✕</button>
        </div>

        {/* Selección de Categoría / Método */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMethod('pago_movil')}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              method === 'pago_movil' || method === 'banco_ve'
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                : 'bg-[#1a2130] border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            🇻🇪 Venezuela (Bs)
          </button>
          <button
            type="button"
            onClick={() => setMethod('nequi')}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              method === 'nequi' || method === 'bancolombia'
                ? 'bg-blue-900/40 border-blue-500 text-blue-400'
                : 'bg-[#1a2130] border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            🇨🇴 Colombia (COP)
          </button>
          <button
            type="button"
            onClick={() => setMethod('crypto')}
            className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              method === 'crypto'
                ? 'bg-purple-900/40 border-purple-500 text-purple-400'
                : 'bg-[#1a2130] border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            🌐 Cripto (USDT/USDC)
          </button>
        </div>

        {/* Sub-métodos para Venezuela */}
        {(method === 'pago_movil' || method === 'banco_ve') && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMethod('pago_movil')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${method === 'pago_movil' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
              Pago Móvil
            </button>
            <button
              onClick={() => setMethod('banco_ve')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${method === 'banco_ve' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
              Transferencia Bancaria
            </button>
          </div>
        )}

        {/* Sub-métodos para Colombia */}
        {(method === 'nequi' || method === 'bancolombia') && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMethod('nequi')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${method === 'nequi' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
              Nequi
            </button>
            <button
              onClick={() => setMethod('bancolombia')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${method === 'bancolombia' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
              Bancolombia
            </button>
          </div>
        )}

        {/* Detalles de la cuenta receptora */}
        {method !== 'crypto' ? (
          <div className="bg-[#1a2130] border border-gray-700 rounded-xl p-4 mb-6 space-y-2 text-sm">
            <h4 className="font-bold text-gray-200 border-b border-gray-700 pb-2 mb-3">
              Datos para realizar el pago ({paymentDetails[method]?.title})
            </h4>
            {Object.entries(paymentDetails[method] || {}).map(([key, val]) => {
              if (key === 'title') return null;
              return (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 capitalize">{key}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-300 font-medium">{val}</span>
                    <button 
                      type="button"
                      onClick={() => handleCopy(val)} 
                      className="text-[10px] bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded border border-gray-600"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#1a2130] border border-gray-700 rounded-xl p-4 mb-6 space-y-3 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Dirección Polygon (USDT/USDC):</span>
              <div className="bg-black/40 p-2 rounded font-mono text-purple-300 break-all select-all">
                {paymentDetails.crypto.polygon}
              </div>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Dirección Base Network (USDC):</span>
              <div className="bg-black/40 p-2 rounded font-mono text-blue-300 break-all select-all">
                {paymentDetails.crypto.base}
              </div>
            </div>
          </div>
        )}

        {/* Formulario de Reporte de Pago (Para Fiat / Transferencias) */}
        {method !== 'crypto' && (
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Reportar mi Pago</h4>
            <div>
              <label className="text-xs text-gray-400">Monto Depositado</label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={method.includes('nequi') || method.includes('bancolombia') ? "Monto en COP" : "Monto en Bs"}
                className="w-full bg-[#1a2130] border border-gray-700 rounded-lg p-2.5 text-white mt-1 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Número de Referencia / Comprobante</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej. 849201"
                className="w-full bg-[#1a2130] border border-gray-700 rounded-lg p-2.5 text-white mt-1 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all mt-2"
            >
              {loading ? 'Registrando Pago...' : 'Reportar Depósito'}
            </button>
          </form>
        )}

        {copied && (
          <div className="mt-3 text-center text-xs text-emerald-400 font-medium">
            ¡Dato copiado al portapapeles!
          </div>
        )}
      </div>
    </div>
  );
}