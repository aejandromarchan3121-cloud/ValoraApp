import { useEffect, useState } from 'react';
import { Button, Input } from '../../components/ui';

export default function DepositModal({ open, onClose, userId, onDone }) {
  const [tab, setTab] = useState('binance');

  // Estados para Binance Pay
  const [amountBinance, setAmountBinance] = useState('');

  // Estados para Fiat Local
  const [currency, setCurrency] = useState('VES');
  const [amountFiat, setAmountFiat] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [refNumber, setRefNumber] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Cuando se abra/cierre el modal, reseteamos lo de fiat para que no quede estado sucio
    if (!open) {
      setTab('binance');
      setAmountBinance('');
      setCurrency('VES');
      setAmountFiat('');
      setOrderData(null);
      setRefNumber('');
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  // Validación mínima para evitar 422
  const safeUserId = userId ?? '';
  if (!safeUserId) {
    // Opcional: puedes cambiar este UI por un spinner o mensaje
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xl space-y-4">
          <h3 className="text-lg font-bold">Recargar Saldo B2B</h3>
          <p className="text-sm text-zinc-500">
            No se pudo obtener el usuario. Intenta cerrar y volver a abrir el modal.
          </p>
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-zinc-500 hover:underline"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // Manejador para Binance Pay
  const handleBinanceDeposit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/deposits/create-binance-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amountBinance) }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // Redirigir a Binance Pay
      } else {
        console.error('Respuesta sin checkoutUrl:', data);
        alert(data?.message || 'No se pudo generar la orden de Binance.');
      }
    } catch (err) {
      console.error('Error generando orden de Binance:', err);
      alert('Ocurrió un error generando la orden de Binance. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 1 (Fiat): Crear la orden y congelar la tasa
  const handleCreateOrder = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await fetch('/api/v1/deposits/create-fiat-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        amount_fiat: Number(amountFiat),
        currency,
      }),
    });

    // Si no es OK, NO intentes parsear JSON
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('create-fiat-order failed:', res.status, text);
      alert(
        `No se pudo crear la orden fiat (${res.status}). ` +
        `Revisa que el endpoint acepte POST y que la ruta sea correcta.`
      );
      return;
    }

    const dataText = await res.text(); // por si viene vacío
    if (!dataText) {
      alert('El servidor respondió vacío al crear la orden.');
      return;
    }

    const data = JSON.parse(dataText);
    if (data.success) setOrderData(data);
    else {
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


  // Paso 2 (Fiat): Enviar el número de referencia del pago realizado
  const handleFinalizeReport = async () => {
    setLoading(true);
    try {
      // Aquí puedes agregar el endpoint real si creas uno para actualizar la referencia.
      alert(
        `¡Orden ${orderData.order_id} reportada con éxito! ` +
          `Quedando a la espera de verificación para acreditar ${orderData.amount_crypto} USDC.`
      );

      if (onDone) onDone();
      onClose();
    } catch (err) {
      console.error('Error al notificar pago:', err);
      alert('No se pudo notificar el pago. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Función para resetear estados al cerrar o cambiar de pestaña
  const handleClose = () => {
    setOrderData(null);
    setAmountFiat('');
    setRefNumber('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold">Recargar Saldo B2B</h3>

        {/* Selector de Pestañas */}
        <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
          <button
            onClick={() => setTab('binance')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'binance'
                ? 'bg-white dark:bg-zinc-700 shadow-sm'
                : 'text-zinc-500'
            }`}
          >
            Binance Pay
          </button>
          <button
            onClick={() => {
              setTab('fiat');
              setOrderData(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'fiat'
                ? 'bg-white dark:bg-zinc-700 shadow-sm'
                : 'text-zinc-500'
            }`}
          >
            Fiat Local (Bs/COP)
          </button>
        </div>

        {tab === 'binance' ? (
          /* FLUJO BINANCE PAY */
          <div className="space-y-3 text-xs">
            <p className="text-zinc-500">
              Recarga instantánea en USDC usando saldo o pasarela de Binance Pay.
            </p>
            <Input
              placeholder="Monto en USD (Ej. 50)"
              type="number"
              value={amountBinance}
              onChange={(e) => setAmountBinance(e.target.value)}
            />
            <Button
              onClick={handleBinanceDeposit}
              disabled={loading || !amountBinance}
              className="w-full"
            >
              {loading ? 'Generando orden...' : 'Continuar con Binance Pay'}
            </Button>
          </div>
        ) : !orderData ? (
          /* FASE 1 FIAT */
          <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
            <p className="text-zinc-500">
              Realiza una transferencia bancaria nacional para acreditar USDC a tu cuenta.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrency('VES')}
                className={`flex-1 py-2 border rounded-lg transition-all ${
                  currency === 'VES'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-500'
                }`}
              >
                Bolívares (VES)
              </button>

              <button
                type="button"
                onClick={() => setCurrency('COP')}
                className={`flex-1 py-2 border rounded-lg transition-all ${
                  currency === 'COP'
                    ? 'border-primary bg-primary/10 font-bold text-primary'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-500'
                }`}
              >
                Pesos (COP)
              </button>
            </div>

            <div className="space-y-1">
              <label>¿Cuánto deseas gastar en {currency}?</label>
              <Input
                type="number"
                placeholder={currency === 'VES' ? 'Ej. 2000' : 'Ej. 400000'}
                value={amountFiat}
                onChange={(e) => setAmountFiat(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading || !amountFiat} className="w-full">
              {loading ? 'Cotizando y creando orden...' : 'Generar Orden y Ver Tasas'}
            </Button>
          </form>
        ) : (
          /* FASE 2 FIAT */
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-1">
              <p className="font-bold text-primary">Orden: {orderData.order_id}</p>
              <p>
                Monto a transferir: <strong>{orderData.amount_fiat} {orderData.currency}</strong>
              </p>
              <p>
                Recibirás aprox: <strong>{orderData.amount_crypto} USDC</strong>{' '}
                <span className="text-zinc-400">(Tasa: {orderData.exchange_rate})</span>
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-1 bg-zinc-50 dark:bg-zinc-800/50">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">Datos Bancarios:</p>
              <p>Banco: {orderData.bank_details.bank}</p>
              <p>Cuenta/Teléfono: {orderData.bank_details.phone}</p>
              <p>RIF/NIT: {orderData.bank_details.rif_or_nit}</p>
            </div>

            <div className="space-y-1">
              <label>Introduce la referencia del pago bancario</label>
              <Input
                placeholder="Ej. 981273"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                required
              />
            </div>

            <Button onClick={handleFinalizeReport} disabled={loading || !refNumber} className="w-full">
              {loading ? 'Enviando...' : 'Notificar Pago Realizado'}
            </Button>
          </div>
        )}

        <button
          onClick={handleClose}
          className="w-full text-center text-xs text-zinc-500 hover:underline mt-2"
        >
          Cancelar y cerrar
        </button>
      </div>
    </div>
  );
}
