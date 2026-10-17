import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Stat, Badge } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { fmt } from '../../lib/money';

export default function Inventory({ rates }) {
  const { rows, insert, update, remove, loading, error } = useTable('inventory_items', 'name');
  const [f, setF] = useState({ name: '', sku: '', qty: 1, cost_usd: '', price_usd: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const bcv = rates.bcv?.price, p2p = rates.p2p?.price;

  const stockCost = rows.reduce((s, r) => s + r.qty * r.cost_usd, 0);
  const stockValue = rows.reduce((s, r) => s + r.qty * r.price_usd, 0);

  const submit = async (e) => {
    e.preventDefault();
    await insert({ ...f, qty: +f.qty, cost_usd: +f.cost_usd || 0, price_usd: +f.price_usd || 0 });
    setF({ name: '', sku: '', qty: 1, cost_usd: '', price_usd: '' });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Inventario</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Costo en stock" value={fmt(stockCost)} />
        <Stat label="Valor de venta" value={fmt(stockValue)} />
        <Stat label="Ganancia potencial" value={fmt(stockValue - stockCost)} tone="text-emerald-500" />
      </div>

      <Card>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <Input className="sm:col-span-2" placeholder="Producto" value={f.name} onChange={set('name')} required />
          <Input placeholder="SKU" value={f.sku} onChange={set('sku')} />
          <Input type="number" min="0" placeholder="Cant." value={f.qty} onChange={set('qty')} />
          <Input type="number" step="0.01" min="0" placeholder="Costo $" value={f.cost_usd} onChange={set('cost_usd')} />
          <Input type="number" step="0.01" min="0" placeholder="Precio $" value={f.price_usd} onChange={set('price_usd')} />
          <Button className="sm:col-span-6"><Plus size={16} /> Agregar producto</Button>
        </form>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Card className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
        {loading && <p className="p-4 text-sm text-zinc-500">Cargando…</p>}
        {rows.map((r) => (
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