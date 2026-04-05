-- ══════════════════════════════════════════════════════════════════
-- PASO 1: CONFIGURAR ADMINS
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- Marcar los admins con rol = 'admin' en la tabla perfiles
UPDATE public.perfiles SET rol = 'admin'
WHERE email IN ('ing.lp.tech@gmail.com', 'cristian590@gmail.com');

-- Verificar (debería mostrar 2 filas con rol = 'admin')
SELECT id, nombre, email, rol FROM public.perfiles
WHERE email IN ('ing.lp.tech@gmail.com', 'cristian590@gmail.com');
