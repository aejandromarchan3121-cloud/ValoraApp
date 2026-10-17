import { useState } from 'react';
import { Send, Sparkles, CalendarPlus, Check } from 'lucide-react';
import { supabase } from '../../supabase';
import { Button, Card, Input, Badge, cx } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { cashflowInsights, parseEntry } from '../../lib/ai';
import { fmt } from '../../lib/money';

/**
 * Agente híbrido: reglas locales (gratis, offline) + gancho opcional a una Edge Function 'ai-agent'
 * para un LLM real. NUNCA pongas API keys de LLM en el front.
 */
export default function AiAgent({ rates, cashTable, fund }) {
  const agenda = useTable('agenda_items');
  const [msgs, setMsgs] = useState([{ role: 'ai', text: 'Dime algo como "recibí 50 usd por zelle de repuestos" y lo registro. O "agenda: pagar proveedor viernes".' }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);

  const add = (m) => setMsgs((x) => [...x, m]);
  const tips = cashflowInsights({ entries: cashTable.rows, p2p: rates.p2p?.price, bcv: rates.bcv?.price, fund });

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim(); if (!text) return;
    setInput(''); add({ role: 'user', text });

    if (/^(agenda|recordar|recu[eé]rdame)\s*:?\s*/i.test(text)) {
      const title = text.replace(/^(agenda|recordar|recu[eé]rdame)\s*:?\s*/i, '');
      await agenda.insert({ title });
      return add({ role: 'ai', text: `Agendado: "${title}".` });
    }
    const entry = parseEntry(text);
    if (entry) {
      setPending(entry);
      return add({ role: 'ai', text: `Entendí: ${fmt(entry.amount, entry.currency)} vía ${entry.method}, categoría "${entry.category}". ¿Confirmas?` });
    }
    // Gancho a LLM real (opcional): supabase.functions.invoke('ai-agent', { body: { text, context } })
    add({ role: 'ai', text: 'Aún no entiendo ese comando. Mira las recomendaciones de abajo o registra un ingreso/agenda.' });
  };

  const confirm = async () => {
    await cashTable.insert(pending);
    add({ role: 'ai', text: 'Registrado en caja ✔' });
    setPending(null);
  };

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><Sparkles size={20} className="text-brand-500" /> Asistente</h1>

      <Card className="space-y-2">
        <p className="text-sm font-medium">Recomendaciones de flujo de caja</p>
        {tips.map((t, i) => <p key={i} className="rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-950/30">{t}</p>)}
      </Card>

      <Card className="space-y-3">
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={cx('max-w-[85%] rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'ml-auto bg-brand-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800')}>{m.text}</div>
          ))}
          {pending && <Button onClick={confirm}><Check size={16} /> Confirmar registro</Button>}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <Input placeholder="Escribe un ingreso o 'agenda: …'" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button><Send size={16} /></Button>
        </form>
      </Card>

      <Card>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><CalendarPlus size={16} /> Agenda</p>
        {!agenda.rows.length && <p className="text-sm text-zinc-500">Sin pendientes.</p>}
        {agenda.rows.map((a) => (
          <label key={a.id} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={a.done} onChange={() => agenda.update(a.id, { done: !a.done })} className="accent-indigo-500" />
            <span className={a.done ? 'text-zinc-400 line-through' : ''}>{a.title}</span>
            {a.done && <Badge tone="green">Hecho</Badge>}
          </label>
        ))}
      </Card>
    </div>
  );
}