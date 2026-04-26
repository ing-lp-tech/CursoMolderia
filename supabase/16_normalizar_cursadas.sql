-- ============================================================
-- 16_normalizar_cursadas.sql
-- EJECUTAR EN: Supabase → SQL Editor
--
-- Normaliza todos los valores de cursada al formato "Cursada N"
-- en las tablas perfiles y finanzas_movimientos.alumno_data
-- ============================================================

-- ── 1. Normalizar perfiles.cursada ────────────────────────────────────────────
UPDATE public.perfiles
SET cursada = CASE
  -- "1", "2", " 3 " → "Cursada 1", "Cursada 2", "Cursada 3"
  WHEN TRIM(cursada) ~ '^[0-9]+$'
    THEN 'Cursada ' || TRIM(cursada)
  -- "cursada 2", "Cursada2", "CURSADA  2" → "Cursada 2"
  WHEN TRIM(cursada) ~* '^cursada\s*[0-9]+$'
    THEN 'Cursada ' || REGEXP_REPLACE(TRIM(cursada), '[^0-9]', '', 'g')
  ELSE TRIM(cursada)
END
WHERE cursada IS NOT NULL AND cursada <> '';

-- ── 2. Normalizar alumno_data.cursada en finanzas_movimientos ─────────────────
UPDATE public.finanzas_movimientos
SET alumno_data = jsonb_set(
  alumno_data,
  '{cursada}',
  to_jsonb(
    CASE
      WHEN TRIM(alumno_data->>'cursada') ~ '^[0-9]+$'
        THEN 'Cursada ' || TRIM(alumno_data->>'cursada')
      WHEN TRIM(alumno_data->>'cursada') ~* '^cursada\s*[0-9]+$'
        THEN 'Cursada ' || REGEXP_REPLACE(TRIM(alumno_data->>'cursada'), '[^0-9]', '', 'g')
      ELSE TRIM(alumno_data->>'cursada')
    END
  )
)
WHERE alumno_data IS NOT NULL
  AND alumno_data ? 'cursada'
  AND alumno_data->>'cursada' IS NOT NULL;

-- ── 3. Verificación ───────────────────────────────────────────────────────────
SELECT 'perfiles' AS tabla, cursada, COUNT(*) AS cantidad
FROM public.perfiles
WHERE cursada IS NOT NULL
GROUP BY cursada
UNION ALL
SELECT 'finanzas' AS tabla, alumno_data->>'cursada', COUNT(*)
FROM public.finanzas_movimientos
WHERE alumno_data->>'cursada' IS NOT NULL
GROUP BY alumno_data->>'cursada'
ORDER BY tabla, cursada;
