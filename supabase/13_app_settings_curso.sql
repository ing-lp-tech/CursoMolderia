-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — Configuración dinámica del curso
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Paso 1: convertir la columna value de boolean a text
-- (el valor existente true/false queda como 'true'/'false')
ALTER TABLE public.app_settings
  ALTER COLUMN value TYPE text USING value::text;

-- Paso 2: insertar configuración por defecto
INSERT INTO public.app_settings (id, value)
VALUES
  ('precio_base',    '400000'),
  ('precio_tachado', '650000'),
  ('fecha_inicio',   '13 de Marzo')
ON CONFLICT (id) DO NOTHING;
