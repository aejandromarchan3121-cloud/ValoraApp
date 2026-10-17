import { useMemo, useRef, useState } from 'react';
import { Minus, Plus, Trash2, ScanBarcode } from 'lucide-react';
import { Button, Card, Input, Stat, Badge } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { fmt } from '../../lib/money';
import { glass } from '../../lib/glass';

const EMPTY = { name: '', sku: '', qty: 1, cost_usd: '', price_usd: '' };

export default function Inventory({ rates }) {
  const { rows, insert, update, remove, loading, error } = useTable('inventory_items', 'name');
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState('');
  const [notice, setNotice] = useState(null);
  const formRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const bcv = rates.bcv?.price, p2p = rates.p2p?.price;

  const stockCost = rows.reduce((s, r) => s + r.qty * r.cost_usd, 0);
  const stockValue = rows.reduce((s, r) => s + r.qty * r.price_usd, 0);

  const flash = (msg, tone = 'ok') => { setNotice({ msg, tone }); setTimeout(() => setNotice(null), 2500); };

  // Escaneo (o Enter manual en el SKU): si existe suma 1 al stock; si es nuevo, rellena el SKU y salta al nombre.
  const handleCode = async (raw) => {
    const code = String(raw).trim();
    if (!code) return;
    const found = rows.find((r) => String(r.sku) === code);
    if (found) {
      await update(found.id, { qty: found.qty + 1 });
      setF((s) => ({ ...s, sku: '' }));
      flash(`+1 ${found.name} (${found.qty + 1} en stock)`);
    } else {
      setF((s) => ({ ...s, sku: code }));
      flash(`SKU nuevo ${code}: completa el producto`, 'new');
      formRef.current?.elements.name?.focus();
    }
  };
  useBarcodeScanner(handleCode);

  const submit = async (e) => {
    e.preventDefault();
    await insert({ ...f, qty: +f.qty, cost_usd: +f.cost_usd || 0, price_usd: +f.price_usd || 0 });
    setF(EMPTY);
    formRef.current?.elements.sku?.focus();
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.name?.toLowerCase().includes(t) || String(r.sku ?? '').toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Inventario</h1>
        <span className="flex items-center gap-1 text-xs text-zinc-500"><ScanBarcode size={14} /> Lector activo</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Costo en stock" value={fmt(stockCost)} />
        <Stat label="Valor de venta" value={fmt(stockValue)} />
        <Stat label="Ganancia potencial" value={fmt(stockValue - stockCost)} tone="text-emerald-500" />
      </div>

      <Card className={glass}>
        <form ref={formRef} onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <Input name="name" className="sm:col-span-2" placeholder="Producto" value={f.name} onChange={set('name')} required />
          {/* data-scan-target: este campo acepta el lector; los demás inputs quedan 100% manuales */}
          <div data-scan-target onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCode(f.sku); } }}>
            <Input name="sku" placeholder="SKU / escanear" value={f.sku} onChange={set('sku')} autoComplete="off" />
          </div>
          <Input type="number" min="0" placeholder="Cant." value={f.qty} onChange={set('qty')} />
          <Input type="number" step="0.01" min="0" placeholder="Costo $" value={f.cost_usd} onChange={set('cost_usd')} />
          <Input type="number" step="0.01" min="0" placeholder="Precio $" value={f.price_usd} onChange={set('price_usd')} />
          <Button className="sm:col-span-6"><Plus size={16} /> Agregar producto</Button>
        </form>
        {notice && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${notice.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>{notice.msg}</p>
        )}
      </Card>

      <Input placeholder="Buscar por nombre o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Card className={`divide-y divide-zinc-100 p-0 dark:divide-zinc-800 ${glass}`}>
        {loading && <p className="p-4 text-sm text-zinc-500">Cargando…</p>}
        {shown.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name} {r.sku && <Badge>{r.sku}</Badge>} {r.qty <= 2 && <Badge tone="amber">Bajo stock</Badge>}</p>
              <p className="text-xs text-zinc-500">
                {fmt(r.price_usd)} · {bcv ? `${(r.price_usd * bcv).toFixed(2)} Bs BCV` : ''} {p2p ? `· ${(r.price_usd * p2p).toFixed(2)} Bs P2P` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="!p-2" onClick={() => update(r.id, { qty: Math.max(0, r.qty - 1) })}><Minus size={14} /></Button>
              <span className="w-8 text-center text-sm tabular-nums">{r.qty}</span>
              <Button variant="ghost" className="!p-2" onClick={() => update(r.id, { qty: r.qty + 1 })}><Plus size={14} /></Button>
            </div>
            <Button variant="danger" className="!p-2" onClick={() => remove(r.id)}><Trash2 size={16} /></Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
