/**
 * Utilidades de tarjeta SOLO para validar y formatear en el navegador (UX).
 * Los datos de tarjeta nunca se guardan, registran ni envían al backend.
 */
export const digits = (s) => String(s ?? '').replace(/\D/g, '');

export function detectBrand(num) {
  const n = digits(num);
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'unknown';
}

export const BRAND_LABEL = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', unknown: 'Tarjeta' };
export const cvcLength = (brand) => (brand === 'amex' ? 4 : 3);

/** "4242424242424242" → "4242 4242 4242 4242" (Amex 4-6-5). */
export function formatCardNumber(raw) {
  const brand = detectBrand(raw);
  const n = digits(raw).slice(0, brand === 'amex' ? 15 : 16);
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
  const out = [];
  let i = 0;
  for (const g of groups) {
    if (i >= n.length) break;
    out.push(n.slice(i, i + g));
    i += g;
  }
  return out.join(' ');
}

/** Algoritmo de Luhn: detecta errores de tecleo. */
export function luhn(num) {
  const n = digits(num);
  if (n.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i += 1) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function isCardNumberValid(num) {
  const brand = detectBrand(num);
  const n = digits(num);
  const lenOk = brand === 'amex' ? n.length === 15 : n.length === 16;
  return lenOk && luhn(n);
}

/** "1" → "01" · "123" → "12/3" · "1226" → "12/26". */
export function formatExpiry(raw) {
  let d = digits(raw).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Válida hasta el último día del mes indicado (MM/AA). */
export function isExpiryValid(mmYY, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmYY ?? '');
  if (!m) return false;
  const mm = Number(m[1]);
  const yyyy = 2000 + Number(m[2]);
  if (mm < 1 || mm > 12) return false;
  return new Date(yyyy, mm, 1) > now && yyyy <= now.getFullYear() + 20;
}

export const isCvcValid = (cvc, brand) => digits(cvc).length === cvcLength(brand);
