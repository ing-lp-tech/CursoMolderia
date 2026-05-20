-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 20: Solicitudes de inscripción web
-- Almacena los datos del formulario de inscripción ANTES de verificar el pago.
-- El admin verifica manualmente en MercadoPago y luego da de alta al alumno.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solicitudes_inscripcion (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre              TEXT        NOT NULL,
  apellido            TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  telefono            TEXT,
  consulta            TEXT,
  plan_id             TEXT,
  plan_label          TEXT,
  monto               NUMERIC,
  monto_original      NUMERIC,
  descuento_aplicado  NUMERIC     DEFAULT 0,
  cupon_codigo        TEXT,
  mp_preference_id    TEXT,
  estado              TEXT        DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'dado_de_alta', 'rechazado')),
  notas_admin         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE solicitudes_inscripcion ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede enviar el formulario de inscripción
CREATE POLICY "solicitudes_insert_publica" ON solicitudes_inscripcion
  FOR INSERT WITH CHECK (true);

-- Solo admin puede ver las solicitudes
CREATE POLICY "solicitudes_admin_select" ON solicitudes_inscripcion
  FOR SELECT USING (public.is_admin());

-- Solo admin puede actualizar el estado
CREATE POLICY "solicitudes_admin_update" ON solicitudes_inscripcion
  FOR UPDATE USING (public.is_admin());

-- Solo admin puede eliminar
CREATE POLICY "solicitudes_admin_delete" ON solicitudes_inscripcion
  FOR DELETE USING (public.is_admin());

-- Permisos de roles
GRANT INSERT                     ON public.solicitudes_inscripcion TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_inscripcion TO authenticated;
