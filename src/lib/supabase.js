import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase env vars missing. Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

// Bypassear el odioso bug de `navigator.locks` en Chrome/Incognito
// Forzamos a Supabase a usar su gestor de concurrencia en memoria para que no pelee en LocalStorage
if (typeof window !== 'undefined' && window.navigator && window.navigator.locks) {
  Object.defineProperty(window.navigator, 'locks', { value: undefined, configurable: true });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
