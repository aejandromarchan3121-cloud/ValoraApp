import { ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react';
import { Badge, EmptyState } from '../../components/ui';
import { num } from '../../lib/money';

const LABEL = {
  ONRAMP_DEPOSIT: 'Depósito desde EE. UU.',
  INTERNAL_P2P: 'Transferencia',
  EXTERNAL_WITHDRAWAL: 'Retiro externo',
  FIAT_CASHOUT: 'Cambio a Bs',
};
const TONE = { COMPLETED: 'green', PENDING: 'amber', FAILED: 'red', CANCELLED: 'zinc' };
const STATUS = { COMPLETED: 'Completada', PENDING: 'Pendiente', FAILED: 'Fallida', CANCELLED: 'Cancelada' };

export default function TxList({ txs, userId }) {
  if (!txs.length) return <EmptyState icon={Landmark} title="Aún no hay movimientos" hint="Tus depósitos, envíos y retiros aparecerán aquí." />;
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {txs.map((t) => {
        const incoming = t.receiver_id === userId;
        const sentFromUs = t.transaction_type === 'ONRAMP_DEPOSIT' && !incoming; // yo envié desde EE. UU.
        const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
        const color = sentFromUs ? 'text-zinc-500' : incoming ? 'text-emerald-500' : 'text-zinc-700 dark:text-zinc-300';
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800 ${color}`}><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{sentFromUs ? 'Envío a Venezuela' : LABEL[t.transaction_type]} <Badge tone={TONE[t.status]}>{STATUS[t.status]}</Badge></p>
              <p className="truncate text-xs text-zinc-500">
                {new Date(t.created_at).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
                {t.metadata?.note ? ` · ${t.metadata.note}` : ''}
              </p>
            </div>
            <p className={`font-semibold tabular-nums ${color}`}>{sentFromUs ? '' : incoming ? '+' : '−'}{num(t.amount)}</p>
          </li>
        );
      })}
    </ul>
  );
}
