-- ══════════════════════════════════════════════════════════════════
-- MOLDI TEX — Cursadas + cobrador por abono
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Columna cursada en perfiles ──────────────────────────────────
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS cursada TEXT DEFAULT 'Cursada 1';

-- Todos los estudiantes existentes van a Cursada 1
UPDATE public.perfiles
  SET cursada = 'Cursada 1'
  WHERE rol = 'estudiante' AND (cursada IS NULL OR cursada = '');

-- ── Nota sobre cobrador por abono ───────────────────────────────────
-- No requiere cambio en la DB.
-- El campo "cobrador" se agrega dentro del JSONB de cada pago
-- en la columna finanzas_movimientos.pagos (array de objetos).
-- El trigger existente solo suma el campo "monto" → no se ve afectado.
-- ════════════════════════════════════════════════════════════════════
