import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { cx, inputCls } from './ui';
import { formatMoneyInput, normalizePasted, padDecimals, parseMoney, toCanonical } from '../lib/moneyInput';

/**
 * Campo de dinero con miles y decimales en vivo (1000 → 1.000, coma = decimales).
 * - value: número (o '' / 0 para vacío)
 * - onChange(numero, textoCanonico): textoCanonico es "1234.56", ideal para enviar al backend
 * - max: tope numérico; si el usuario escribe más, el campo se corrige solo al tope
 */
const MoneyInput = forwardRef(function MoneyInput(
  { value, onChange, decimals = 2, max, padOnBlur = true, className, onBlur, ...rest },
  outerRef
) {
  const ref = useRef(null);
  const caret = useRef(null);
  useImperativeHandle(outerRef, () => ref.current);

  const toDisplay = (n) => (Number(n) ? formatMoneyInput(String(n).replace('.', ','), decimals) : '');
  const [display, setDisplay] = useState(() => toDisplay(value));

  // Si el padre cambia el valor desde fuera (p. ej. al limpiar el formulario), sincroniza.
  useEffect(() => {
    if (parseMoney(display) !== (Number(value) || 0)) setDisplay(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Mantiene el cursor donde estaba aunque cambie el número de puntos.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current == null || document.activeElement !== el) return;
    let pos = display.length;
    if (caret.current !== Infinity) {
      pos = 0;
      let seen = 0;
      while (pos < display.length && seen < caret.current) {
        if (/[\d,]/.test(display[pos])) seen += 1;
        pos += 1;
      }
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [display]);

  const clamp = (text) => (max != null && parseMoney(text) > max
    ? formatMoneyInput(String(max).replace('.', ','), decimals) : text);

  const commit = (rawNext, caretTarget) => {
    const next = clamp(rawNext);
    caret.current = next !== rawNext ? Infinity : caretTarget;
    setDisplay(next);
    onChange?.(parseMoney(next), toCanonical(next, decimals));
  };

  const handleChange = (e) => {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    const atEnd = pos >= el.value.length;
    const before = el.value.slice(0, pos).replace(/[^\d,]/g, '').length; // dígitos y coma antes del cursor
    commit(formatMoneyInput(el.value, decimals), atEnd ? Infinity : before);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const el = e.target;
    const pasted = normalizePasted(e.clipboardData.getData('text'));
    const raw = el.value.slice(0, el.selectionStart) + pasted + el.value.slice(el.selectionEnd);
    commit(formatMoneyInput(raw, decimals), Infinity);
  };

  const handleBlur = (e) => {
    if (padOnBlur && display) {
      const padded = padDecimals(display, decimals);
      if (padded !== display) setDisplay(padded); // el valor numérico no cambia
    }
    onBlur?.(e);
  };

  return (
    <input
      ref={ref}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      className={cx(inputCls, 'tabular-nums', className)}
      value={display}
      onChange={handleChange}
      onPaste={handlePaste}
      onBlur={handleBlur}
      {...rest}
    />
  );
});

export default MoneyInput;
