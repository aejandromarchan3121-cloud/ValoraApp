import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Input } from '../ui';
import { supabase } from '../../supabase';

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

  // Función para iniciar sesión con Google
  const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`, // Redirige de vuelta a la app tras autenticar
    },
  });
  if (error) console.error('Error iniciando sesión con Google:', error.message);
};

// Función para iniciar sesión con GitHub
const handleGithubLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) console.error('Error iniciando sesión con GitHub:', error.message);
};

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6">
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-500 font-bold text-white">$</div>
          <h1 className="text-xl font-semibold">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
          <p className="text-sm text-zinc-500">Tu caja, inventario y tasas en un solo lugar.</p>
        </div>
        <div className="flex flex-col gap-3 my-4 w-full">
  {/* Botón Google */}
  <button
    type="button"
    onClick={handleGoogleLogin}
    className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl border border-gray-300 transition-all shadow-sm"
  >
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
    Continuar con Google
  </button>

  {/* Botón GitHub */}
  <button
    type="button"
    onClick={handleGithubLogin}
    className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-[#24292e] hover:bg-[#1b1f23] text-white font-medium rounded-xl transition-all shadow-sm"
  >
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
    Continuar con GitHub
  </button>
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