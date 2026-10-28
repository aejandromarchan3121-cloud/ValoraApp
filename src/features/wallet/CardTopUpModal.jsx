import { Button, Card } from '../../components/ui';

export default function CardTopUpModal({ open, onClose, onSuccess }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white p-6 dark:bg-zinc-900">
        <p className="text-lg font-bold">Recargar con tarjeta (Sandbox)</p>
        <p className="text-sm text-zinc-500 mt-2">Módulo en entorno de pruebas.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      </Card>
    </div>
  );
}