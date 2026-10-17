import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Input } from '../ui';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', business: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data, error } = mode === 'login'
      ? await signIn(f.email, f.password)
      : await signUp(f.email, f.password, f.business);
    setBusy(false);
    if (error) return setMsg({ ok: false, t: error.message });
    if (mode === 'register' && !data.session)
      setMsg({ ok: true, t: 'Cuenta creada. Revisa tu correo para confirmar.' });
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-500 font-bold text-white">$</div>
          <h1 className="text-xl font-semibold">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
          <p className="text-sm text-zinc-500">Tu caja, inventario y tasas en un solo lugar.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && <Input placeholder="Nombre del negocio" value={f.business} onChange={set('business')} required />}
          <Input type="email" placeholder="Correo" value={f.email} onChange={set('email')} required autoComplete="email" />
          <Input type="password" placeholder="Contraseña (mín. 6)" minLength={6} value={f.password} onChange={set('password')} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {msg && <p className={msg.ok ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>{msg.t}</p>}
          <Button className="w-full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Registrarme'}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-brand-500"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(null); }}>
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </Card>
    </main>
  );
}