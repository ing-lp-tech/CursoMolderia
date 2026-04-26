-- ============================================================
-- 17_tabla_finanzas_notas.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Tabla para anotaciones, recordatorios y ajustes de cuentas
-- dentro de la sección Finanzas del panel admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finanzas_notas (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
  autor           TEXT         NOT NULL,
  texto           TEXT         NOT NULL,
  comprobante_url TEXT         DEFAULT NULL,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- Índice para ordenar por fecha descendente
CREATE INDEX IF NOT EXISTS idx_finanzas_notas_fecha
  ON public.finanzas_notas (fecha DESC);

-- Acceso: el anon key puede leer/escribir (la seguridad la maneja el panel admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finanzas_notas TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.finanzas_notas TO anon;

-- Notificar a PostgREST para que reconozca la nueva tabla
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT 'Tabla finanzas_notas creada correctamente ✓' AS status;
