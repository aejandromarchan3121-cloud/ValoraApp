/** Reparte un ingreso entre caja y fondo de emergencia según el % configurado. */
export function allocateSale(amountUsd, pct) {
  const p = Math.min(Math.max(Number(pct) || 0, 0), 100);
  const toFund = +(amountUsd * (p / 100)).toFixed(2);
  return { toFund, toCash: +(amountUsd - toFund).toFixed(2), pct: p };
}
