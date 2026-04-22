import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULTS = {
  precio_base: 400000,
  precio_tachado: 650000,
  fecha_inicio: '13 de Marzo',
  test_mode_mp: false,
};

const AppSettingsContext = createContext({ ...DEFAULTS, loaded: false, refetch: () => {} });

function parseSettings(data) {
  const map = Object.fromEntries(data.map(r => [r.id, r.value]));
  return {
    precio_base:    map.precio_base    ? Number(map.precio_base)    : DEFAULTS.precio_base,
    precio_tachado: map.precio_tachado ? Number(map.precio_tachado) : DEFAULTS.precio_tachado,
    fecha_inicio:   map.fecha_inicio   || DEFAULTS.fecha_inicio,
    test_mode_mp:   map.test_mode_mp === true || map.test_mode_mp === 'true',
  };
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(() => {
    supabase
      .from('app_settings')
      .select('id, value')
      .then(({ data }) => {
        if (data) setSettings(parseSettings(data));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <AppSettingsContext.Provider value={{ ...settings, loaded, refetch }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
