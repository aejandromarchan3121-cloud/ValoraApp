# Cambios · Recarga con tarjeta + Aporte al fondo + Velas

**Orden:** 1) migración SQL → 2) backend → 3) frontend. Dependencias del zip anterior que deben existir:
`features/wallet/Modal.jsx`, `components/MoneyInput.jsx`, `lib/moneyInput.js`, `ui.jsx` con `PageHeader`/`EmptyState`/`inputCls`, `lib/money.js` con `num`.

```bash
npm i recharts            # gráfico de velas (probado con 3.10)
```

## 1. Archivos nuevos o reemplazados (copiar tal cual a tu `src/`)
| Archivo | Qué es |
|---|---|
| `lib/card.js` | Formato y validación de tarjeta (Luhn, MM/AA, CVC) |
| `features/wallet/CardTopUpModal.jsx` | **Nuevo** · modal de recarga |
| `features/emergency/ContributionRate.jsx` | **Nuevo** · slider + input del % |
| `features/emergency/EmergencyFund.jsx` | **Reemplaza** el anterior (integra el % y aportes relativos) |
| `features/analytics/CandlestickChart.jsx` | **Nuevo** · velas con Recharts |
| `features/analytics/Analytics.jsx` | **Reemplaza** el anterior |
| `hooks/useRateCandles.js`, `hooks/useRateRecorder.js`, `lib/demoCandles.js` | **Nuevos** |
| `components/MoneyInput.jsx` | **Reemplaza** (ahora acepta `max`) |
| `features/wallet/TxList.jsx`, `WalletDashboard.jsx`, `api/wallet.js` | **Reemplazan** (etiqueta CARD_TOPUP, 5.ª acción, `topUpSandbox`) |

## 2. Ediciones a mano en archivos tuyos
**`src/index.css`** — estilo del slider (también arregla la barra blanca rota del simulador de Tasas: ponle `className="range-brand"` y `style={{ '--p': (dias / 60) * 100 + '%' }}`):
```css
.range-brand { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 9999px; cursor: pointer;
  background: linear-gradient(to right, #6366f1 var(--p, 0%), rgb(113 113 122 / .3) var(--p, 0%)); }
.range-brand::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
  border-radius: 9999px; background: #fff; border: 3px solid #6366f1; box-shadow: 0 1px 4px rgb(0 0 0 / .35); }
.range-brand::-moz-range-thumb { width: 20px; height: 20px; border-radius: 9999px; background: #fff; border: 3px solid #6366f1; }
.range-brand::-moz-range-track { background: transparent; }
.range-brand:focus-visible { outline: 2px solid #6366f1; outline-offset: 4px; }
```

**`src/lib/money.js`** — equivalente en USD de cada ingreso (lo usa el aporte automático):
```js
export function usdEquivForEntry(amount, currency, p2p) {
  if (currency === 'USD') return undefined;            // la BD ya usa el monto
  const usd = toUSD(amount, currency, { p2p });
  return usd > 0 ? Math.round(usd * 100) / 100 : null; // sin tasa → null (no se inventa)
}
```

**`src/App.jsx`** (dentro de `Dashboard`, junto a `useRates`):
```jsx
import { useRateRecorder } from './hooks/useRateRecorder';
// ...
useRateRecorder(rates);   // guarda una foto de las tasas cada 10 min: alimenta las velas
```

**Caja (`CashPanel` / formulario de registro) y asistente** — añade `usd_equiv` al objeto que insertas:
```js
import { usdEquivForEntry } from '../../lib/money';
insert({ ...entry, usd_equiv: usdEquivForEntry(entry.amount, entry.currency, rates.p2p?.price) });
// AiAgent.jsx → en confirm(), para 'register_entry':  cashTable.insert({ ...p.args, usd_equiv: usdEquivForEntry(p.args.amount, p.args.currency, rates.p2p?.price) })
```

**Tu pantalla de Billetera** (donde está el botón "Recargar con Tarjeta"):
```jsx
import CardTopUpModal from '../wallet/CardTopUpModal';
const [topUpOpen, setTopUpOpen] = useState(false);
<button onClick={() => setTopUpOpen(true)}>Recargar con Tarjeta</button>
<CardTopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} onSuccess={() => refrescarSaldo()} />
```
(Si usas mi `WalletDashboard`, ya trae el botón: solo activa `VITE_SANDBOX_TOPUP=true`.)

## 3. Variables de entorno
```
# frontend (.env y Vercel)               # backend (.env)
VITE_SANDBOX_TOPUP=true                  SANDBOX_TOPUP_ENABLED=true     # solo pruebas
                                         SANDBOX_TOPUP_MAX_USD=500
```

## 4. Seguridad: léelo antes de activar
- **Los datos de tarjeta nunca salen del navegador**: se validan en memoria, se borran al cerrar y al backend solo viaja el monto. Aun así, **no uses estos campos para cobrar tarjetas reales**: hacerlo te obliga a cumplir PCI DSS. Para cobrar de verdad, usa los campos alojados de tu proveedor (Stripe Elements, etc.) en lugar de los tres inputs; el resto del modal se conserva.
- La recarga **crea saldo ficticio en el mismo libro** que el saldo real. Úsala **solo en un proyecto Supabase de pruebas**, déjala apagada por defecto y elimina la función antes de producción: `drop function sandbox_topup(uuid, numeric, text);`
- Esta versión acredita **USDC** (1 USD = 1 USDC). USDT no se ofrece porque hoy ninguna función de envío ni retiro mueve `usdt_balance`: quedaría saldo atrapado.

## 5. Probar
`python -m pytest -q` (backend, 12) · `python supabase/tests/ledger_test2.py` (SQL) · `frontend/tests/ui.test.jsx` con Vitest + jsdom (11): ver `vitest.config.example.js`.
