import Modal from './Modal';
import CopyRow from './CopyRow';

export default function ReceiveModal({ open, onClose, username }) {
  const msg = username
    ? `Envíame dinero desde EE. UU. a mi @${username} en ValoraApp.`
    : '';
  return (
    <Modal open={open} onClose={onClose} title="Recibir de EE. UU.">
      {username ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">Comparte tu @usuario con quien te envía. Al confirmarse su pago, tu saldo se acredita solo.</p>
          <CopyRow label="Tu @usuario" value={`@${username}`} strong />
          <CopyRow label="Mensaje para compartir" value={msg} />
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Primero elige tu @usuario en la pantalla principal de la billetera.</p>
      )}
    </Modal>
  );
}
