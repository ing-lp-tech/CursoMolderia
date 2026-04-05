// @refresh reset
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Admin emails solo desde variable de entorno — nunca hardcodeados en producción
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setUser(session?.user ?? null);
      if (session?.user) fetchPerfil(session.user.id);
      else setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) await fetchPerfil(session.user.id);
        else { setPerfil(null); setLoading(false); }
      }
    );
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  // Auto-logout por inactividad (30 minutos para el admin)
  useEffect(() => {
    let inactivityTimer;
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      if (user) {
        inactivityTimer = setTimeout(() => signOut(), TIMEOUT_MS);
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    if (user) {
      resetTimer();
      events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    }
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  async function fetchPerfil(userId) {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, email, telefono, rol, activo, created_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setPerfil(data);
    } catch {
      // No exponer detalles del error al usuario
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut(e) {
    if (e && e.preventDefault) e.preventDefault();

    // Limpiar tokens de Supabase del storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });

    setUser(null);
    setPerfil(null);

    // Redirigir inmediatamente
    window.location.href = '/login';

    // Notificar a Supabase en background (sin bloquear)
    supabase.auth.signOut().catch(() => {});
  }

  // Fuente de verdad principal: tabla perfiles en BD (respaldada por RLS)
  // El email como fallback solo sirve en desarrollo con VITE_ADMIN_EMAILS
  const isAdmin =
    perfil?.rol === 'admin' ||
    (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user?.email?.toLowerCase()));

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
