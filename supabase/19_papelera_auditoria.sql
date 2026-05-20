-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 19: Papelera de reciclaje + Auditoría
-- Agrega columnas de borrado lógico a todas las tablas relevantes
-- y crea la tabla de auditoría de acciones.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Borrado lógico en perfiles (estudiantes) ──────────────────────────────────
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en cupones ─────────────────────────────────────────────────
ALTER TABLE cupones
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en recursos ────────────────────────────────────────────────
ALTER TABLE recursos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en finanzas_movimientos ────────────────────────────────────
ALTER TABLE finanzas_movimientos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en finanzas_notas ─────────────────────────────────────────
ALTER TABLE finanzas_notas
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Borrado lógico en costos_alumnos ─────────────────────────────────────────
ALTER TABLE costos_alumnos
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS eliminado_por_email TEXT;

-- ── Tabla de auditoría ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_origen        TEXT        NOT NULL,
  registro_id         TEXT        NOT NULL,
  accion              TEXT        NOT NULL CHECK (accion IN ('eliminacion', 'modificacion', 'restauracion', 'creacion')),
  descripcion         TEXT,
  datos_anteriores    JSONB,
  datos_nuevos        JSONB,
  realizado_por       UUID        REFERENCES auth.users(id),
  realizado_por_email TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Solo admin puede ver la auditoría
CREATE POLICY "admin_ver_auditoria" ON auditoria
  FOR SELECT USING (public.is_admin());

-- Cualquier usuario autenticado puede insertar (para registrar sus propias acciones)
CREATE POLICY "auth_registrar_auditoria" ON auditoria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
