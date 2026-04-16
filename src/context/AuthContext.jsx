import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false); // evita doble inicialización

  useEffect(() => {
    // Timeout de seguridad: si algo falla, no quedar colgado en spinner
    const safetyTimeout = setTimeout(() => setLoading(false), 10_000);

    // ── Paso 1: leer sesión actual desde localStorage (sin red)
    // getSession() maneja token expirado: si hay refresh token válido, lo renueva
    // y devuelve la sesión correcta. NO retorna null mientras renueva.
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimeout);
      initDone.current = true;
      setUser(session?.user ?? null);
      if (session?.user) fetchPerfil(session.user.id);
      else setLoading(false);
    }).catch(() => {
      clearTimeout(safetyTimeout);
      initDone.current = true;
      setLoading(false);
    });

    // ── Paso 2: escuchar cambios POSTERIORES a la inicialización
    // Se salta INITIAL_SESSION para evitar la race condition:
    // onAuthStateChange dispara INITIAL_SESSION con null mientras el token
    // se está refrescando, lo que causaba un redirect prematuro al login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignorar el evento inicial — ya lo maneja getSession() arriba
        if (event === 'INITIAL_SESSION') return;

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchPerfil(session.user.id);
        } else {
          setPerfil(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Auto-logout por inactividad (30 min)
  useEffect(() => {
    if (!user) return;
    const TIMEOUT_MS = 30 * 60 * 1000;
    let timer = setTimeout(() => signOut(), TIMEOUT_MS);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => signOut(), TIMEOUT_MS); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]);

  async function fetchPerfil(userId) {
    // Timeout de 8s: evita que loading quede en true indefinidamente
    // si Supabase no responde (problema con CSP, red o clave inválida)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('fetchPerfil timeout')), 8_000)
    );
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('perfiles')
          .select('id, nombre, apellido, email, telefono, rol, activo, created_at')
          .eq('id', userId)
          .single(),
        timeoutPromise,
      ]);
      if (error) throw error;
      setPerfil(data);
    } catch {
      // El perfil es opcional: si falla, se usa VITE_ADMIN_EMAILS como fallback
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut(e) {
    if (e?.preventDefault) e.preventDefault();
    setUser(null);
    setPerfil(null);
    // Primero invalidar sesión en Supabase (server-side), luego limpiar local
    try { await supabase.auth.signOut(); } catch {}
    window.location.href = '/login';
  }

  const isAdmin =
    perfil?.rol === 'admin' ||
    (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user?.email?.toLowerCase()));

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
