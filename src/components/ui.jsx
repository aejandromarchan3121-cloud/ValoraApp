export const cx = (...c) => c.filter(Boolean).join(' ');

export const Card = ({ className, children, ...p }) => (
  <div className={cx('rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900', className)} {...p}>
    {children}
  </div>
);

export const Button = ({ variant = 'primary', className, ...p }) => (
  <button
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium active:scale-[.98] disabled:opacity-50',
      variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
      variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
      variant === 'danger' && 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40',
      className
    )}
    {...p}
  />
);

export const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700';

export const Input = (p) => <input className={inputCls} {...p} />;

export const Select = ({ children, ...p }) => (
  <select className={inputCls + ' dark:bg-zinc-900'} {...p}>{children}</select>
);

export const Badge = ({ tone = 'zinc', children }) => {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    brand: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  };
  return <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
};

export const Stat = ({ label, value, hint, tone }) => (
  <Card>
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    <p className={cx('mt-1 text-2xl font-semibold tabular-nums', tone)}>{value}</p>
    {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
  </Card>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon: Icon, title, hint }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-center">
    {Icon && <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon size={22} /></div>}
    <p className="text-sm font-medium">{title}</p>
    {hint && <p className="max-w-xs text-xs text-zinc-500">{hint}</p>}
  </div>
);