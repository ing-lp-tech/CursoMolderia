import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Obtenemos los admins desde las variables de entorno
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await signIn(email, password);
    
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }

    // Chequeamos admin por email, metadatos, o tabla perfiles
    const userEmail = data?.user?.email?.toLowerCase() || '';
    const metaRol = data?.user?.user_metadata?.rol;
    let isDbAdmin = false;

    if (data?.user?.id) {
      try {
        const { data: profile } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', data.user.id)
          .single();
        if (profile?.rol === 'admin') isDbAdmin = true;
      } catch (e) {
        // Ignorar si falla por RLS o si no existe
      }
    }

    const isAdmin = metaRol === 'admin' || ADMIN_EMAILS.includes(userEmail) || isDbAdmin;
    setLoading(false);

    if (isAdmin) navigate('/admin');
    else navigate('/portal');
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
            <div className="bg-error-container/20 border border-error/30 rounded-lg px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2">
            {loading
              ? <><span className="material-symbols-outlined text-sm">refresh</span>Ingresando...</>
              : <><span className="material-symbols-outlined text-sm">login</span>Ingresar</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
