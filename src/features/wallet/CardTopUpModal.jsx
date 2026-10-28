import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FlaskConical, Lock } from 'lucide-react';
import Modal from './Modal';
import MoneyInput from '../../components/MoneyInput';
import { Badge, Button, Input, cx } from '../../components/ui';
import { topUpSandbox } from '../../api/wallet';
import {
  BRAND_LABEL, cvcLength, detectBrand, digits, formatCardNumber, formatExpiry,
  isCardNumberValid, isCvcValid, isExpiryValid,
} from '../../lib/card';
import { num } from '../../lib/money';

/**
 * Recarga con tarjeta → USDC (1 USD = 1 USDC). MODO SIMULACIÓN.
 *
 * SEGURIDAD: número, vencimiento y CVC solo se validan aquí, en memoria; nunca se
 * guardan, registran ni se envían al backend (solo viaja el monto). Para cobrar de verdad,
 * sustituye estos tres campos por los "hosted fields" de tu proveedor (PCI): el resto del
 * modal (monto, pasos, éxito/error, onSuccess) se conserva igual.
 */
const STEPS = ['Validando tarjeta…', 'Autorizando el pago…', 'Convirtiendo a USDC…'];
const DECLINE_TEST_CARD = '4000000000000002';
const MIN_USD = 5;
const MAX_USD = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const testExpiry = () => `12/${String((new Date().getFullYear() + 2) % 100).padStart(2, '0')}`;

function Field({ label, error, children, className }) {
  return (
    <label className={cx('block text-xs text-zinc-500', className)}>
      {label}
      <div className="mt-1">{children}</div>
      {error && <span role="alert" className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </label>
  );
}

export default function CardTopUpModal({ open, onClose, onSuccess, stepMs = 800 }) {
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState('0');
  const [touched, setTouched] = useState({});
  const [phase, setPhase] = useState('form'); // form | processing | done
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const idem = useRef(crypto.randomUUID());

  const brand = detectBrand(number);
  const errs = {
    number: !isCardNumberValid(number) && 'Número de tarjeta inválido.',
    expiry: !isExpiryValid(expiry) && 'Fecha inválida o vencida.',
    cvc: !isCvcValid(cvc, brand) && `El CVC tiene ${cvcLength(brand)} dígitos.`,
    amount: (amount < MIN_USD || amount > MAX_USD) && `Entre ${MIN_USD} y ${MAX_USD} USD.`,
  };
  const valid = !Object.values(errs).some(Boolean);
  const show = (k) => touched[k] && errs[k];
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const wipe = () => {
    setNumber(''); setExpiry(''); setCvc(''); setAmount(0); setAmountStr('0');
    setTouched({}); setError(null); setResult(null); setPhase('form'); setStep(0);
  };
  const close = () => { if (phase === 'processing') return; wipe(); onClose(); };
  useEffect(() => { if (!open) wipe(); }, [open]); // nunca quedan datos de tarjeta al cerrar

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ number: true, expiry: true, cvc: true, amount: true });
    if (!valid) return;
    setError(null); setPhase('processing'); setStep(0);
    try {
      await sleep(stepMs); setStep(1);
      await sleep(stepMs);
      if (digits(number) === DECLINE_TEST_CARD) throw new Error('El emisor rechazó la tarjeta (simulación). Prueba con otra.');
      setStep(2);
      const res = await topUpSandbox({ amountUsd: amountStr, key: idem.current }); // ← solo el monto
      setResult({ ...res, amount });
      setPhase('done');
      idem.current = crypto.randomUUID();
      setNumber(''); setExpiry(''); setCvc('');
      onSuccess?.(res);
    } catch (err) {
      setError(err.message); setPhase('form'); setCvc('');
    }
  };

  const fillTest = () => {
    setNumber(formatCardNumber('4242424242424242')); setExpiry(testExpiry()); setCvc('123');
    setTouched({});
  };

  return (
    <Modal open={open} onClose={close} title={phase === 'done' ? 'Recarga completada' : 'Recargar con tarjeta'}>
      {phase === 'form' && (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <FlaskConical size={16} className="mt-0.5 shrink-0" />
            <span>
              <b>Modo prueba:</b> no se cobra ninguna tarjeta real.{' '}
              <button type="button" onClick={fillTest} className="underline">Usar tarjeta de prueba</button>
            </span>
          </div>

          <Field label="Número de tarjeta" error={show('number')}>
            <div className="relative">
              <Input inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456"
                aria-invalid={Boolean(show('number'))} value={number}
                onChange={(e) => setNumber(formatCardNumber(e.target.value))} onBlur={() => touch('number')} />
              {brand !== 'unknown' && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Badge tone="brand">{BRAND_LABEL[brand]}</Badge></span>}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiración (MM/AA)" error={show('expiry')}>
              <Input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" maxLength={5}
                aria-invalid={Boolean(show('expiry'))} value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))} onBlur={() => touch('expiry')} />
            </Field>
            <Field label="CVC" error={show('cvc')}>
              <Input type="password" inputMode="numeric" autoComplete="cc-csc" placeholder={'•'.repeat(cvcLength(brand))}
                maxLength={cvcLength(brand)} aria-invalid={Boolean(show('cvc'))} value={cvc}
                onChange={(e) => setCvc(digits(e.target.value).slice(0, cvcLength(brand)))} onBlur={() => touch('cvc')} />
            </Field>
          </div>

          <Field label="Monto a recargar (USD)" error={show('amount')}>
            <MoneyInput className="!py-3.5 text-2xl font-semibold" placeholder="0,00" max={MAX_USD} value={amount}
              aria-invalid={Boolean(show('amount'))} onBlur={() => touch('amount')}
              onChange={(n, s) => { setAmount(n); setAmountStr(s); }} />
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2.5 text-sm dark:bg-zinc-800">
            <span className="text-zinc-500">Recibirás</span>
            <span className="font-semibold tabular-nums text-emerald-500">≈ {num(amount)} USDC</span>
          </div>
          <p className="text-[11px] text-zinc-500">Conversión automática 1 USD = 1 USDC.</p>

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={!amount}><Lock size={14} /> Pagar {amount ? `${num(amount)} USD` : ''}</Button>
        </form>
      )}

      {phase === 'processing' && (
        <div className="space-y-4 py-6 text-center" aria-live="polite">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-brand-500 dark:border-zinc-700" />
          <p className="font-medium">{STEPS[step]}</p>
          <div className="mx-auto flex max-w-[12rem] gap-1.5">
            {STEPS.map((s, i) => <span key={s} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand-500' : 'bg-zinc-200 dark:bg-zinc-700')} />)}
          </div>
          <p className="text-xs text-zinc-500">No cierres esta ventana.</p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
          <p className="text-3xl font-semibold tabular-nums">+{num(result.amount)} <span className="text-base text-zinc-500">USDC</span></p>
          {result.balance != null && <p className="text-sm text-zinc-500">Nuevo saldo: <b>{num(result.balance)} USDC</b></p>}
          <Button className="w-full" onClick={close}>Listo</Button>
        </div>
      )}
    </Modal>
  );
}
