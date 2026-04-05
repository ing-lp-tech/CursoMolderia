import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://curso-molderia.vercel.app',
  'https://molditex.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  // ── Verificar que el solicitante sea admin ──────────────────────────────────
  const jwt = req.headers.authorization?.replace('Bearer ', '');
  if (!jwt) return res.status(401).json({ error: 'Token requerido' });

  const supabaseUrl    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey        = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  // Verificar JWT del solicitante
  const clientVerify = createClient(supabaseUrl, anonKey || serviceRoleKey);
  const { data: { user: solicitante }, error: authError } = await clientVerify.auth.getUser(jwt);
  if (authError || !solicitante) return res.status(401).json({ error: 'Sesión inválida' });

  // Cliente admin (service role) — omite RLS
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verificar rol admin en la BD
  const { data: perfil } = await adminClient
    .from('perfiles')
    .select('rol')
    .eq('id', solicitante.id)
    .single();

  if (perfil?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede eliminar alumnos' });
  }

  // ── Eliminar el usuario ─────────────────────────────────────────────────────
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId es requerido' });

  // No permitir que el admin se elimine a sí mismo
  if (userId === solicitante.id) {
    return res.status(400).json({ error: 'No podés eliminar tu propia cuenta' });
  }

  // Verificar que el usuario a eliminar exista y sea estudiante
  const { data: target } = await adminClient
    .from('perfiles')
    .select('rol, email')
    .eq('id', userId)
    .single();

  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.rol === 'admin') {
    return res.status(403).json({ error: 'No se puede eliminar otro administrador' });
  }

  // Eliminar pagos del estudiante primero
  await adminClient.from('pagos').delete().eq('estudiante_id', userId);

  // Eliminar perfil
  await adminClient.from('perfiles').delete().eq('id', userId);

  // Eliminar de Supabase Auth (requiere service role)
  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    console.error('[eliminar-alumno] Error al eliminar de Auth:', deleteAuthError.message);
    return res.status(500).json({ error: 'El perfil fue eliminado pero hubo un error en Auth: ' + deleteAuthError.message });
  }

  return res.status(200).json({ success: true, message: 'Alumno eliminado correctamente' });
}
