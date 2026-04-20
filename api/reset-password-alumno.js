import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://curso-molderia.vercel.app',
  'https://molditex.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function generarPassword() {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghjkmnpqrstuvwxyz';
  const nums  = '23456789';
  const syms  = '@#$!';
  const rand  = arr => arr[Math.floor(Math.random() * arr.length)];
  const base  = [rand(mayus), rand(mayus), rand(minus), rand(minus), rand(nums), rand(nums), rand(syms)];
  const pool  = mayus + minus + nums;
  for (let i = 0; i < 3; i++) base.push(rand(pool));
  return base.sort(() => Math.random() - 0.5).join('');
}

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

  // Cliente admin (service role)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verificar que el solicitante sea admin
  const { data: perfilAdmin } = await adminClient
    .from('perfiles')
    .select('rol')
    .eq('id', solicitante.id)
    .single();

  if (perfilAdmin?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede resetear contraseñas' });
  }

  const { userId, customPassword } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId es requerido' });

  // Validar contraseña custom si se provee
  if (customPassword !== undefined) {
    if (typeof customPassword !== 'string' || customPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (!/[A-Z]/.test(customPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos una mayúscula' });
    }
    if (!/[0-9]/.test(customPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });
    }
  }

  // Verificar que el target sea estudiante
  const { data: target } = await adminClient
    .from('perfiles')
    .select('rol, email, nombre')
    .eq('id', userId)
    .single();

  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.rol === 'admin') {
    return res.status(403).json({ error: 'No se puede resetear la contraseña de otro administrador' });
  }

  const newPassword = customPassword || generarPassword();

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateError) {
    console.error('[reset-password] Error:', updateError.message);
    return res.status(500).json({ error: 'Error al resetear contraseña: ' + updateError.message });
  }

  // Guardar contraseña en perfiles para visibilidad del admin
  await adminClient.from('perfiles').update({ ultima_password: newPassword }).eq('id', userId);

  return res.status(200).json({
    success: true,
    newPassword,
    email: target.email,
    nombre: target.nombre,
  });
}
