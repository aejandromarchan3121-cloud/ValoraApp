import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, Check, Send, Sparkles, X } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, cx } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { askAgent, buildContext, sanitizeAction } from '../../api/ai';
import { cashflowInsights, parseEntry } from '../../lib/ai';
import { fmt } from '../../lib/money';

const QUICK = ['¿Cómo va mi flujo de caja?', '¿Convierto hoy o espero?', 'Resume mi semana', 'Agenda: pagar proveedor el viernes'];
const GREETING = {
  role: 'assistant',
  content: '¡Hola! Soy Caja 👋 Cuéntame un ingreso (“recibí 50 usd por zelle”), pídeme agendar algo o pregúntame cómo va tu flujo.',
};

export default function AiAgent({ rates, cashTable, fund }) {
  const agenda = useTable('agenda_items');
  const [msgs, setMsgs] = useState([GREETING]);
  const [proposals, setProposals] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [offline, setOffline] = useState(false);
  const endRef = useRef(null);

  const tips = cashflowInsights({ entries: cashTable.rows, p2p: rates.p2p?.price, bcv: rates.bcv?.price, fund });
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, thinking, proposals]);

  // Respaldo local si el backend/IA no responde: el asistente nunca se queda mudo.
  const localFallback = (text) => {
    const a = text.match(/^(?:agenda|recordar|recu[eé]rdame)\s*:?\s*(.+)/i);
    if (a) return { reply: 'Lo anoto en tu agenda. ¿Confirmas?', actions: [{ type: 'add_agenda', args: { title: a[1] } }] };
    const entry = parseEntry(text);
    if (entry) return { reply: 'Esto entendí. ¿Lo registro?', actions: [{ type: 'register_entry', args: entry }] };
    return { reply: tips.join(' '), actions: [] };
  };

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    const history = [...msgs, { role: 'user', content: text }];
    setMsgs(history);
    setThinking(true);
    let out;
    try {
      out = await askAgent(history.slice(1), buildContext({ rates, cashTable, fund }));
      setOffline(false);
    } catch (err) {
      if (err.code === 'PLAN_REQUIRED' || err.code === 'AI_LIMIT') out = { reply: err.message, actions: [] };
      else { out = localFallback(text); setOffline(true); }
    }
    setMsgs((m) => [...m, { role: 'assistant', content: out.reply }]);
    setProposals((p) => [...p, ...(out.actions ?? []).map(sanitizeAction).filter(Boolean).map((a) => ({ ...a, id: crypto.randomUUID() }))]);
    setThinking(false);
  };

  const confirm = async (p) => {
    try {
      if (p.type === 'register_entry') await cashTable.insert(p.args);
      else await agenda.insert(p.args);
      setMsgs((m) => [...m, { role: 'assistant', content: p.type === 'register_entry' ? '¡Listo! Ya quedó en tu caja ✅' : 'Anotado en tu agenda 📌' }]);
      setProposals((x) => x.filter((y) => y.id !== p.id));
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: `No pude guardarlo: ${e.message}` }]);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Asistente" subtitle="Registra ingresos, agenda tareas y pide recomendaciones."
        action={offline && <Badge tone="amber">Modo local</Badge>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div key={i} className={cx('flex gap-2', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-white"><Sparkles size={14} /></span>}
                <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                  m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800')}>{m.content}</div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-1 pl-9" aria-label="Escribiendo">
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d * 120}ms` }} />)}
              </div>
            )}
            {proposals.map((p) => (
              <div key={p.id} className="ml-9 flex items-center gap-2 rounded-xl border border-dashed border-brand-500/50 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {p.type === 'register_entry'
                    ? <>Registrar <b>{fmt(p.args.amount, p.args.currency)}</b> · {p.args.method} · {p.args.category}</>
                    : <><CalendarCheck size={14} className="mr-1 inline" />{p.args.title}</>}
                </span>
                <Button className="!px-3 !py-1.5" onClick={() => confirm(p)}><Check size={14} /></Button>
                <Button variant="ghost" className="!px-3 !py-1.5" onClick={() => setProposals((x) => x.filter((y) => y.id !== p.id))}><X size={14} /></Button>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={thinking}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-brand-500 hover:text-brand-500 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">{q}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input placeholder="Escribe aquí…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1500} />
            <Button disabled={thinking || !input.trim()} aria-label="Enviar"><Send size={16} /></Button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-2">
            <p className="text-sm font-medium">Recomendaciones</p>
            {tips.map((t, i) => <p key={i} className="rounded-lg bg-indigo-50 p-3 text-xs dark:bg-indigo-950/30">{t}</p>)}
          </Card>
          <Card>
            <p className="mb-2 text-sm font-medium">Agenda</p>
            {!agenda.rows.length && <p className="text-sm text-zinc-500">Sin pendientes.</p>}
            {agenda.rows.map((a) => (
              <label key={a.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={a.done} onChange={() => agenda.update(a.id, { done: !a.done })} className="accent-indigo-500" />
                <span className={a.done ? 'text-zinc-400 line-through' : ''}>{a.title}</span>
              </label>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
