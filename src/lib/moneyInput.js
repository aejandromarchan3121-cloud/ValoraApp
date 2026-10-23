/**
 * Formato numérico es-VE mientras se escribe: punto = miles, coma = decimales.
 * Funciones puras (sin React) para poder probarlas con facilidad.
 */
const GROUP_RE = /\B(?=(\d{3})+(?!\d))/g;

/** Texto crudo del input → texto formateado ("1000" → "1.000", "1234,5" → "1.234,5"). */
export function formatMoneyInput(raw, maxDecimals = 2) {
  let s = String(raw ?? '').replace(/[^\d.,]/g, '');
  // Un "." recién tecleado al final (teclados numéricos US) cuenta como coma decimal.
  // Los puntos que ya están en pantalla son separadores de miles y se ignoran.
  if (!s.includes(',') && s.endsWith('.')) s = s.slice(0, -1) + ',';
  const i = s.indexOf(',');
  let int = (i === -1 ? s : s.slice(0, i)).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  let dec = i === -1 ? null : s.slice(i + 1).replace(/\D/g, '').slice(0, maxDecimals);
  if (maxDecimals === 0) dec = null;
  if (i !== -1 && int === '') int = '0';
  const grouped = int.replace(GROUP_RE, '.');
  return dec === null ? grouped : `${grouped},${dec}`;
}

/** "1.234,5" → 1234.5 (número JS, solo para cálculos de UI). */
export function parseMoney(display) {
  if (!display) return 0;
  const n = Number(String(display).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** "1.234,5" → "1234.5": string exacto para enviar al backend (Decimal). */
export function toCanonical(display, maxDecimals = 6) {
  if (!display) return '0';
  const [i, d = ''] = String(display).replace(/\./g, '').split(',');
  return d ? `${i || '0'}.${d.slice(0, maxDecimals)}` : i || '0';
}

/** Completa decimales al salir del campo: "12" → "12,00", "12,5" → "12,50". */
export function padDecimals(display, decimals) {
  if (!display || decimals <= 0) return display;
  const [i, d = ''] = display.split(',');
  return `${i},${d.padEnd(decimals, '0')}`;
}

/**
 * Texto pegado → formato interno (coma decimal, sin puntos).
 * "1,234.56" → "1234,56" · "1.234.567" → "1234567" · "12.5" → "12,5" · "1.234" → "1234".
 * Convención es-VE: un solo "." seguido de 3 dígitos es separador de miles.
 */
export function normalizePasted(text) {
  let s = String(text ?? '').trim().replace(/[^\d.,]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    return s.split(thou).join('').replace(dec, ',');
  }
  if (lastDot === -1 && lastComma === -1) return s;
  const sep = lastDot !== -1 ? '.' : ',';
  const parts = s.split(sep);
  const last = parts[parts.length - 1];
  const thousands = parts.length > 2 || (sep === '.' && last.length === 3);
  return thousands ? parts.join('') : `${parts[0]},${parts[1]}`;
}
