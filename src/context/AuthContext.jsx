// @refresh reset
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Obtenemos los admins desde las variables de entorno + HARCODEAMOS LA SOLUCIÓN DEFINITIVA
const ADMIN_EMAILS = [
  'ing.lp.tech@gmail.com',
  'cristian590@gmail.com',
  ...(import.meta.env.VITE_ADMIN_EMAILS || '').split(',')
]
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout de seguridad: si en 5 segundos no responde Supabase, quitamos el spinner
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

  useEffect(() => {
    let inactivityTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      if (user) {
        // 5 minutos = 5 * 60 * 1000 ms = 300000 ms
        inactivityTimer = setTimeout(() => {
          signOut();
        }, 300000);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    if (user) {
      resetTimer();
      events.forEach(e => window.addEventListener(e, resetTimer));
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
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      setPerfil(data);
    } catch (err) {
      console.error("Error cargando perfil desde Supabase:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  }

  async function signOut(e) {
    if (e && e.preventDefault) e.preventDefault();
    console.log("Cerrando sesión de forma forzada...");
    
    // 1. Limpiar TODAS las claves de Supabase en localStorage INMEDIATAMENTE
    Object.keys(localStorage).forEach(key => {
      if (key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });

    // 2. Limpiar estados de React
    setUser(null);
    setPerfil(null);

    // 3. Forzar redirección INMEDIATAMENTE (el navegador cortará la ejecución aquí)
    window.location.href = '/login';

    // 4. Intentar decirle a Supabase que cierre la sesión en el servidor, 
    // pero no esperamos a que termine para sacar al usuario de la pantalla.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Fallo silencioso al cerrar en servidor:", err);
    }
  }

  // Admin si: tabla perfiles dice admin, O metadatos de Auth dicen admin, O email está en lista
  const isAdmin =
    perfil?.rol === 'admin' ||
    user?.user_metadata?.rol === 'admin' ||
    ADMIN_EMAILS.includes(user?.email?.toLowerCase());

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
