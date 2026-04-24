-- ============================================================
-- 15_add_alumno_data.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Agrega la columna alumno_data (JSONB) a finanzas_movimientos
-- para guardar los datos del alumno al registrar una Matrícula.
-- Script 100% seguro (no rompe nada si ya existe).
-- ============================================================

-- 1. Agregar columna alumno_data (si no existe)
ALTER TABLE public.finanzas_movimientos
  ADD COLUMN IF NOT EXISTS alumno_data JSONB DEFAULT NULL;

-- 2. Comentario descriptivo
COMMENT ON COLUMN public.finanzas_movimientos.alumno_data IS
  'Datos del alumno { nombre, apellido, email, telefono, cursada } — solo se llena cuando categoria = Matrícula';

-- 3. Índice para consultas rápidas desde EstudiantesPage
--    (filtra rápido los movimientos con alumno_data relleno)
CREATE INDEX IF NOT EXISTS idx_finanzas_alumno_data
  ON public.finanzas_movimientos (categoria)
  WHERE alumno_data IS NOT NULL;

-- 4. Recargar el schema cache de PostgREST para que la API REST
--    reconozca la nueva columna sin necesidad de reiniciar
NOTIFY pgrst, 'reload schema';

-- 5. Verificación: muestra las columnas actuales de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'finanzas_movimientos'
ORDER BY ordinal_position;
