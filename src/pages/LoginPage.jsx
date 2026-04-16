import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = [
  'ing.lp.tech@gmail.com',
  'cristian590@gmail.com',
  ...(import.meta.env.VITE_ADMIN_EMAILS || '').split(','),
]
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Timeout de 20s: previene que el botón quede colgado si Supabase no responde
      const loginTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          'Tiempo de espera agotado (20s). Verificá tu conexión a internet o las credenciales de Supabase en .env.local'
        )), 20_000)
      );

      const { data, error: err } = await Promise.race([
        signIn(email, password),
        loginTimeout,
      ]);

      if (err) {
        setError(
          err.message?.includes('Invalid login')
            ? 'Email o contraseña incorrectos.'
            : err.message || 'Error al iniciar sesión.'
        );
        return;
      }

      const userEmail = data?.user?.email?.toLowerCase() || '';
      const metaRol   = data?.user?.user_metadata?.rol;

      // Verificar rol en la tabla perfiles (fallback a lista de emails si falla)
      let dbRol = null;
      try {
        const { data: perfilData } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', data.user.id)
          .single();
        dbRol = perfilData?.rol ?? null;
      } catch {
        // Ignorar — se usa ADMIN_EMAILS como fallback
      }

      const isUserAdmin = metaRol === 'admin' || dbRol === 'admin' || ADMIN_EMAILS.includes(userEmail);

      navigate(isUserAdmin ? '/admin' : '/portal', { replace: true });
    } catch (ex) {
      setError(ex?.message || 'Error inesperado al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <span className="material-symbols-outlined text-primary text-5xl">architecture</span>
          <h1 className="font-headline text-3xl font-bold mt-3 tracking-tight">Moldi Tex</h1>
          <p className="text-on-surface-variant text-sm mt-2">Ingresa a tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 border border-outline-variant/30">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                tabIndex={-1}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPass ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error/30 rounded-lg px-4 py-3 text-sm text-error whitespace-pre-wrap">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2">
            {loading
              ? <><span className="material-symbols-outlined text-sm animate-spin">refresh</span>Ingresando...</>
              : <><span className="material-symbols-outlined text-sm">login</span>Ingresar</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
