// Clases "vidrio" para Card (funcionan en modo claro y oscuro). El ! gana sobre los estilos base de Card.
// Tip: pega esta misma cadena dentro de tu <Card> en components/ui y TODA la app cambia de golpe.
export const glass =
  'border !border-zinc-200/70 !bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] ' +
  'dark:!border-white/[0.08] dark:!bg-white/[0.03] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

export const chip =
  'rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 ' +
  'dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5';
export const chipActive =
  '!border-indigo-400/60 !bg-indigo-500/10 !text-indigo-600 dark:!text-indigo-200';
