-- ============================================================
-- EJECUTAR EN: Supabase → SQL Editor
-- PROPÓSITO: Guardar datos del alumno al registrar una Matrícula
--            en Finanzas, para luego dar de alta desde Estudiantes
-- ============================================================

-- 1. Agregar columna para guardar los datos del alumno (nombre, apellido, email, telefono, cursada)
--    Solo se llena cuando la categoría es "Matrícula"
ALTER TABLE finanzas_movimientos
  ADD COLUMN IF NOT EXISTS alumno_data JSONB;

-- 2. Comentario descriptivo
COMMENT ON COLUMN finanzas_movimientos.alumno_data IS
  'Datos del alumno (nombre, apellido, email, telefono, cursada) cuando la categoría es Matrícula. Se usa para dar de alta desde EstudiantesPage.';

-- ============================================================
-- VERIFICAR que la columna quedó correctamente:
-- ============================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'finanzas_movimientos'
--   AND column_name = 'alumno_data';
