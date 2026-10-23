import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyRow({ label, value, strong = false }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(value)); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sin permiso */ }
  };
  return (
    <button type="button" onClick={copy}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
        <span className={`block truncate tabular-nums ${strong ? 'text-base font-semibold text-brand-500' : 'text-sm'}`}>{value}</span>
      </span>
      {ok ? <Check size={16} className="shrink-0 text-emerald-500" /> : <Copy size={16} className="shrink-0 text-zinc-400" />}
    </button>
  );
}
