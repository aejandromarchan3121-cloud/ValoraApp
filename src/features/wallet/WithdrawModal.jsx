import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import Modal from './Modal';
import MoneyInput from '../../components/MoneyInput';
import { Button, Input, Select } from '../../components/ui';
import { withdrawExternal } from '../../api/wallet';
import { num } from '../../lib/money';

/** Retiro a Binance u otra wallet externa vía Base o Polygon. */
export default function WithdrawModal({ open, onClose, onDone, balance }) {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('base');
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const idem = useRef(crypto.randomUUID());

  const close = () => { setDone(null); setError(null); setAmount(0); setAmountStr('0'); setAddress(''); idem.current = crypto.randomUUID(); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { setDone(await withdrawExternal({ amount: amountStr, address: address.trim(), network, key: idem.current })); onDone?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title="Retirar a Binance / wallet">
      {!done ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-zinc-500">Red
            <Select className="mt-1" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="base">Base (USDC)</option>
              <option value="polygon">Polygon (USDC)</option>
            </Select>
          </label>
          <label className="block text-xs text-zinc-500">Dirección de depósito (0x…)
            <Input className="mt-1 font-mono text-xs" value={address} onChange={(e) => setAddress(e.target.value)} required autoCapitalize="none" spellCheck={false} />
          </label>
          <label className="block text-xs text-zinc-500">Monto (USDC) · mínimo 5 · disponible {num(balance)}
            <MoneyInput className="mt-1 !py-3.5 text-2xl font-semibold" value={amount} placeholder="0,00"
              onChange={(n, s) => { setAmount(n); setAmountStr(s); }} />
          </label>
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Verifica que la red coincida con la de tu exchange: un envío a la red equivocada no se puede recuperar.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={busy || amount < 5 || amount > balance || address.length < 42}>{busy ? 'Procesando…' : 'Solicitar retiro'}</Button>
        </form>
      ) : (
        <div className="space-y-3 text-center">
          <Clock className="mx-auto text-amber-500" size={44} />
          <p className="font-medium">{done.status === 'completed' ? '¡Retiro enviado!' : 'Retiro en revisión'}</p>
          <p className="text-sm text-zinc-500">
            {done.status === 'completed' ? 'La transacción ya está en la red.' : 'Lo revisamos y lo enviamos en breve. Si se rechaza, tu saldo se devuelve automáticamente.'}
          </p>
          <Button className="w-full" onClick={close}>Cerrar</Button>
        </div>
      )}
    </Modal>
  );
}
