import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Modal from './Modal';
import CopyRow from './CopyRow';
import MoneyInput from '../../components/MoneyInput';
import { Button, Input } from '../../components/ui';
import { createCheckoutSession, startKyc } from '../../api/wallet';
import { num } from '../../lib/money';

/** Flujo de cobro (quien envía desde EE. UU.): monto + destinatario → instrucciones de depósito. */
export default function OnRampModal({ open, onClose, onDone }) {
  const [recipient, setRecipient] = useState('@');
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [kycNeeded, setKycNeeded] = useState(false);
  const [result, setResult] = useState(null);

  const close = () => { setResult(null); setError(null); setKycNeeded(false); setAmount(0); setAmountStr('0'); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setKycNeeded(false);
    try {
      setResult(await createCheckoutSession({ recipient: recipient.trim(), amountUsd: amountStr }));
      onDone?.();
    } catch (err) {
      if (err.code === 'KYC_REQUIRED') setKycNeeded(true);
      setError(err.message);
    } finally { setBusy(false); }
  };

  const verify = async () => {
    try {
      const { kyc_url: url } = await startKyc();
      if (url) window.open(url, '_blank', 'noopener');
      else setError('Verificación iniciada. Vuelve a intentarlo en unos minutos.');
    } catch (err) { setError(err.message); }
  };

  const p = result?.payload;
  return (
    <Modal open={open} onClose={close} title={result ? 'Instrucciones de depósito' : 'Enviar desde EE. UU.'}>
      {!result ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-zinc-500">¿Quién recibe? (@usuario o +teléfono)
            <Input className="mt-1" value={recipient} onChange={(e) => setRecipient(e.target.value)} required autoCapitalize="none" />
          </label>
          <label className="block text-xs text-zinc-500">Monto a enviar (USD)
            <MoneyInput className="mt-1 !py-3.5 text-2xl font-semibold" value={amount} placeholder="0,00"
              onChange={(n, s) => { setAmount(n); setAmountStr(s); }} />
          </label>
          <p className="text-xs text-zinc-500">Mínimo 10 USD. Recibirás instrucciones para una transferencia bancaria (ACH/wire).</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {kycNeeded && <Button type="button" variant="ghost" className="w-full" onClick={verify}><ShieldAlert size={16} /> Verificar mi identidad</Button>}
          <Button className="w-full" disabled={busy || amount < 10}>{busy ? 'Creando…' : 'Continuar'}</Button>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Envía exactamente <b>${num(p.amount_usd)}</b> e incluye el <b>mensaje de depósito</b>: sin él no podremos identificar tu pago.
          </p>
          <CopyRow label="Mensaje de depósito" value={p.deposit_message} strong />
          <CopyRow label="Banco" value={p.bank_name} />
          <CopyRow label="Beneficiario" value={p.beneficiary} />
          <CopyRow label="Routing" value={p.routing_number} />
          <CopyRow label="Cuenta" value={p.account_number} />
          <p className="pt-1 text-xs text-zinc-500">El saldo se acredita solo cuando se confirma el pago. Puedes cerrar esta ventana.</p>
          <Button className="w-full" onClick={close}>Listo</Button>
        </div>
      )}
    </Modal>
  );
}
