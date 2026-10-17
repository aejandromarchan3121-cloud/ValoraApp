# Integrar el lector en Inventory.jsx (sin tocar tu lógica Supabase)

```jsx
import { useRef } from 'react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import SkuField from './SkuField';

// items = tu lista actual de productos; setForm = tu estado del formulario
const nameRef = useRef(null);

const handleCode = (code) => {
  const found = items.find((p) => String(p.sku) === code);
  if (found) {
    // YA EXISTE -> suma 1 al stock con TU función actual de update
    // updateProduct(found.id, { stock: (found.stock ?? 0) + 1 });
  } else {
    // NUEVO -> rellena SKU y salta al nombre
    setForm((f) => ({ ...f, sku: code }));
    nameRef.current?.focus();
  }
};

useBarcodeScanner(handleCode);

// reemplaza tu <input> de SKU por:
<SkuField value={form.sku} onChange={(v) => setForm((f) => ({ ...f, sku: v }))} onResolve={handleCode} />
```
Los inputs manuales (Producto, Costo, Precio, cantidad) quedan igual: el lector solo actúa en el SKU o fuera de inputs.
