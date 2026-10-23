import { useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import MoneyInput from '../../components/MoneyInput';
import { Button, Input } from '../../components/ui';
import { sendInternal } from '../../api/wallet';
import { num } from '../../lib/money';

/** P2P interno por @usuario o teléfono: instantáneo y sin comisión. */
export default function SendModal({ open, onClose, onDone, balance }) {
  const [recipient, setRecipient] = useState('@');
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [step, setStep] = useState('form'); // form | confirm | done
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const idem = useRef(crypto.randomUUID()); // misma clave si reintentas la misma operación

  const reset = () => { setStep('form'); setAmount(0); setAmountStr('0'); setNote(''); setError(null); idem.current = crypto.randomUUID(); };
  const close = () => { reset(); onClose(); };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      await sendInternal({ recipient: recipient.trim(), amount: amountStr, note, key: idem.current });
      setStep('done'); onDone?.();
    } catch (err) { setError(err.message); setStep('form'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title="Enviar a @usuario">
      {step === 'form' && (
        <form onSubmit={(e) => { e.preventDefault(); setStep('confirm'); }} className="space-y-3">
          <label className="block text-xs text-zinc-500">Destinatario
            <Input className="mt-1" value={recipient} onChange={(e) => setRecipient(e.target.value)} required autoCapitalize="none" />
          </label>
          <label className="block text-xs text-zinc-500">Monto (USDC) · disponible {num(balance)}
            <MoneyInput className="mt-1 !py-3.5 text-2xl font-semibold" value={amount} placeholder="0,00"
              onChange={(n, s) => { setAmount(n); setAmountStr(s); }} />
          </label>
          <Input placeholder="Nota (opcional)" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={amount <= 0 || amount > balance}>Revisar</Button>
        </form>
      )}
      {step === 'confirm' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-zinc-100 p-4 text-center dark:bg-zinc-800">
            <p className="text-3xl font-semibold tabular-nums">{num(amount)} <span className="text-base text-zinc-500">USDC</span></p>
            <p className="mt-1 text-sm text-zinc-500">para <b>{recipient}</b> · sin comisión</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStep('form')} disabled={busy}>Editar</Button>
            <Button className="flex-1" onClick={confirm} disabled={busy}>{busy ? 'Enviando…' : 'Confirmar envío'}</Button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
          <p className="font-medium">¡Enviado!</p>
          <Button className="w-full" onClick={close}>Cerrar</Button>
        </div>
      )}
    </Modal>
  );
}
