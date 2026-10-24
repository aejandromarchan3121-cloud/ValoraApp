import { useState } from 'react';
import { Button, Input, Modal } from '../../components/ui';

export default function DepositModal({ open, onClose, userId, onDone }) {
  const [amountFiat, setAmountFiat] = useState('');
  const [currency, setCurrency] = useState('VES'); // 'VES' o 'COP'
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ruta ajustada exactamente al prefijo de tu backend FastAPI (/api/v1/deposits/...)
      const res = await fetch('/api/v1/deposits/create-fiat-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount_fiat: Number(amountFiat),
          currency,
        }),
      });

      // Si no es OK, leemos como texto plano para evitar que explote con HTML o errores de servidor
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('create-fiat-order failed:', res.status, text);
        alert(
          `No se pudo crear la orden fiat (${res.status}). ` +
          `Revisa los datos ingresados o el servidor.`
        );
        return;
      }

      const dataText = await res.text();
      if (!dataText) {
        alert('El servidor respondió vacío al crear la orden.');
        return;
      }

      const data = JSON.parse(dataText);
      if (data.success) {
        setOrderData(data);
        if (onDone) onDone();
      } else {
        console.error('Error creando orden fiat:', data);
        alert(data?.message || 'No se pudo generar la orden fiat.');
      }
    } catch (err) {
      console.error('Error creando orden fiat:', err);
      alert('No se pudo generar la orden fiat. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setOrderData(null);
    setAmountFiat('');
    onClose();
  };

  return (
    <Modal open={open} onClose={resetAndClose} title="Depositar / Recargar Fiat">
      {!orderData ? (
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Moneda local</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="VES">Bolívares (VES)</option>
              <option value="COP">Pesos Colombianos (COP)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Monto a depositar</label>
            <Input
              type="number"
              step="any"
              placeholder="0.00"
              value={amountFiat}
              onChange={(e) => setAmountFiat(e.target.value)}
              required
            />
          </div>

          <Button className="w-full" disabled={loading}>
            {loading ? 'Generando orden...' : 'Crear orden de depósito'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="font-semibold">¡Orden generada con éxito!</p>
            <p className="text-xs mt-1">Número de orden: <b>{orderData.order_id}</b></p>
          </div>

          <div className="space-y-1 text-zinc-600 dark:text-zinc-300">
            <p><b>Monto Fiat:</b> {orderData.amount_fiat} {orderData.currency}</p>
            <p><b>Equivalente Crypto:</b> {orderData.amount_crypto} USDC</p>
            <p><b>Tasa de cambio:</b> {orderData.exchange_rate}</p>
          </div>

          {orderData.bank_details && (
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 space-y-1">
              <p className="font-medium text-xs text-zinc-500 uppercase">Datos bancarios para transferencia:</p>
              <p><b>Banco:</b> {orderData.bank_details.bank}</p>
              <p><b>Cuenta:</b> {orderData.bank_details.account}</p>
              <p><b>RIF/NIT:</b> {orderData.bank_details.rif_or_nit}</p>
              <p><b>Teléfono:</b> {orderData.bank_details.phone}</p>
            </div>
          )}

          <Button className="w-full" variant="outline" onClick={resetAndClose}>
            Cerrar
          </Button>
        </div>
      )}
    </Modal>
  );
}