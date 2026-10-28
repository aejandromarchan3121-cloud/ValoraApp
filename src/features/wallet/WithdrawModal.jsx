import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import Modal from './Modal';
import MoneyInput from '../../components/MoneyInput';
import { Button, Input, Select } from '../../components/ui';
import { withdrawExternal } from '../../api/wallet';
import { supabase } from '../../supabase';
import { num } from '../../lib/money';

export default function WithdrawModal({ open, onClose, onDone, balance }) {
  const [method, setMethod] = useState('crypto'); // 'crypto' o 'bs'
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('base');
  
  // Estados para retiro en Bolívares (Pago Móvil / Banco)
  const [banco, setBanco] = useState('0102'); // Ejemplo: Banco de Venezuela
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const idem = useRef(crypto.randomUUID());

  // Tasa de referencia Bs/USD (puedes ajustarla o traerla de tu contexto de tasas)
  const tasaBs = 36.5; 

  const close = () => { 
    setDone(null); setError(null); setAmount(0); setAmountStr('0'); 
    setAddress(''); setTelefono(''); setCedula('');
    idem.current = crypto.randomUUID(); 
    onClose(); 
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      if (method === 'crypto') {
        const res = await withdrawExternal({ amount: amountStr, address: address.trim(), network, key: idem.current });
        setDone(res);
      } else {
        // Registrar solicitud de retiro en Bolívares (Pago Móvil / Banco Nacional) en Supabase
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'WITHDRAW_BS',
          amount_usdc: amount,
          amount_bs: amount * tasaBs,
          details: { banco, telefono, cedula },
          status: 'PENDING'
        });
        if (txError) throw txError;
        setDone({ status: 'pending_review', message: 'Retiro en Bs solicitado con éxito.' });
      }
      onDone?.();
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setBusy(false); 
    }
  };

  return (
    <Modal open={open} onClose={close} title="Retirar fondos">
      {!done ? (
        <form onSubmit={submit} className="space-y-3">
          {/* Selector de método de retiro */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <button
              type="button"
              onClick={() => setMethod('crypto')}
              className={`py-2 text-xs font-medium rounded-lg transition-all ${method === 'crypto' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Cripto (USDC)
            </button>
            <button
              type="button"
              onClick={() => setMethod('bs')}
              className={`py-2 text-xs font-medium rounded-lg transition-all ${method === 'bs' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Bolívares (Pago Móvil)
            </button>
          </div>

          {method === 'crypto' ? (
            <>
              <label className="block text-xs text-zinc-400">Red
                <Select className="mt-1" value={network} onChange={(e) => setNetwork(e.target.value)}>
                  <option value="base">Base (USDC)</option>
                  <option value="polygon">Polygon (USDC)</option>
                </Select>
              </label>
              <label className="block text-xs text-zinc-400">Dirección de depósito (0x…)
                <Input className="mt-1 font-mono text-xs" value={address} onChange={(e) => setAddress(e.target.value)} required autoCapitalize="none" spellCheck={false} />
              </label>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <label className="block text-xs text-zinc-400">Banco destino
                <Select className="mt-1" value={banco} onChange={(e) => setBanco(e.target.value)}>
                  <option value="0102">Banco de Venezuela</option>
                  <option value="0105">Banesco</option>
                  <option value="0134">Bancaribe</option>
                  <option value="0108">Banco Provincial</option>
                  <option value="0191">Banco Nacional de Crédito (BNC)</option>
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-zinc-400">Teléfono (Pago Móvil)
                  <Input className="mt-1 text-xs" placeholder="04141234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
                </label>
                <label className="block text-xs text-zinc-400">Cédula de Identidad
                  <Input className="mt-1 text-xs" placeholder="V12345678" value={cedula} onChange={(e) => setCedula(e.target.value)} required />
                </label>
              </div>
            </div>
          )}

          <label className="block text-xs text-zinc-400">Monto a retirar (USDC) · disponible {num(balance)}
            <MoneyInput className="mt-1 !py-3.5 text-2xl font-semibold" value={amount} placeholder="0,00"
              onChange={(n, s) => { setAmount(n); setAmountStr(s); }} />
          </label>

          {method === 'bs' && amount > 0 && (
            <p className="text-xs text-emerald-400 font-medium">
              Recibirás aprox: <span className="font-bold">{(amount * tasaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
            </p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          
          <Button className="w-full" disabled={busy || amount <= 0 || amount > balance || (method === 'crypto' && address.length < 42) || (method === 'bs' && (!telefono || !cedula))}>
            {busy ? 'Procesando…' : method === 'crypto' ? 'Solicitar Retiro Cripto' : 'Solicitar Retiro en Bolívares'}
          </Button>
        </form>
      ) : (
        <div className="space-y-3 text-center">
          <Clock className="mx-auto text-amber-500" size={44} />
          <p className="font-medium">¡Solicitud registrada con éxito!</p>
          <p className="text-sm text-zinc-400">
            Tu orden ha sido guardada en tu historial. El sistema la procesará y el dinero llegará a tu destino configurado en breve.
          </p>
          <Button className="w-full" onClick={close}>Cerrar</Button>
        </div>
      )}
    </Modal>
  );
}