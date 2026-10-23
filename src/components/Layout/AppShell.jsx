import { useEffect, useState } from 'react';
import { Boxes, Wallet, CreditCard, ArrowLeftRight, ShieldCheck, Sparkles, BarChart3, Moon, Sun, LogOut, Landmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { PLAN_LABEL } from '../../lib/plans';
import { Badge, cx } from '../ui';

export const NAV = [
  { id: 'rates', label: 'Tasas', icon: ArrowLeftRight },
  { id: 'cash', label: 'Caja', icon: Wallet },
  { id: 'wallet', label: 'Billetera', icon: Landmark, full: true },
  { id: 'inventory', label: 'Inventario', icon: Boxes },
  { id: 'emergency', label: 'Emergencia', icon: ShieldCheck, full: true },
  { id: 'ai', label: 'Asistente', icon: Sparkles, full: true },
  { id: 'analytics', label: 'Analíticas', icon: BarChart3, full: true },
];

function useDark() {
  const [dark, setDark] = useState(() => localStorage.theme ? localStorage.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.theme = dark ? 'dark' : 'light';
  }, [dark]);
  return [dark, setDark];
}

export default function AppShell({ view, setView, children }) {
  const { signOut, user } = useAuth();
  const { plan, can } = usePlan();
  const [dark, setDark] = useDark();

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 p-4 dark:border-zinc-800 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 font-bold text-white">$</div>
          <span className="font-semibold">CajaP2P</span>
          <Badge tone={plan === 'full' ? 'brand' : 'zinc'}>{PLAN_LABEL[plan]}</Badge>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ id, label, icon: Icon, full }) => (
            <button key={id} onClick={() => setView(id)}
              className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm',
                view === id ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
              <Icon size={18} /> {label}
              {full && !can(id) && <span className="ml-auto text-[10px] text-zinc-400">FULL</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <p className="truncate px-3 text-xs text-zinc-500">{user?.email}</p>
          <button onClick={() => setDark(!dark)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <LogOut size={18} /> Salir
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <div className="mb-4 flex justify-end gap-1 md:hidden">
          <button onClick={() => setDark(!dark)} className="rounded-lg p-2 text-zinc-500">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={signOut} className="rounded-lg p-2 text-zinc-500"><LogOut size={18} /></button>
        </div>
        {children}
      </main>

      {/* Tab bar móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden">
        {NAV.filter((n) => !n.full || can(n.id)).slice(0, 5).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className={cx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]', view === id ? 'text-brand-500' : 'text-zinc-500')}>
            <Icon size={20} /> {label}
          </button>
        ))}
      </nav>
    </div>
  );
}