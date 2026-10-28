import { api } from './http';

// Los montos viajan como string canónico ("1234.56"): sin pérdida de precisión.
export const createCheckoutSession = ({ recipient, amountUsd }) =>
  api('/onramp/checkout-session', { method: 'POST', body: { recipient, amount_usd: amountUsd } });

export const startKyc = () => api('/onramp/kyc-link', { method: 'POST' });

export const sendInternal = ({ recipient, amount, note, key }) =>
  api('/transfer/internal', { method: 'POST', idempotencyKey: key, body: { recipient, amount, note: note || null } });

export const withdrawExternal = ({ amount, address, network, key }) =>
  api('/transfer/withdraw-external', { method: 'POST', idempotencyKey: key, body: { amount, address, network } });

// Recarga simulada: viaja SOLO el monto (nunca datos de tarjeta).
export const topUpSandbox = ({ amountUsd, key }) =>
  api('/wallet/topup-sandbox', { method: 'POST', idempotencyKey: key, body: { amount_usd: amountUsd } });
