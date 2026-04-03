-- ══════════════════════════════════════════════════════
-- 1. TABLA CUPONES
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cupones (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value       numeric NOT NULL CHECK (value > 0),
  description text,
  expires_at  timestamptz,
  max_uses    integer NOT NULL DEFAULT 0,
  used_count  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  is_flash    boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Índice único case-insensitive para evitar códigos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS cupones_code_unique_idx
  ON public.cupones (UPPER(code));
