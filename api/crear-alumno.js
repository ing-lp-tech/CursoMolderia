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
  // 3 chars aleatorios extra
  const pool  = mayus + minus + nums;
  for (let i = 0; i < 3; i++) base.push(rand(pool));
  // Mezclar
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

  if (process.env.NODE_ENV === 'production' && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  // ── Verificar que el solicitante sea admin ──────────────────────────────────
  const jwt = req.headers.authorization?.replace('Bearer ', '');
  if (!jwt) return res.status(401).json({ error: 'Token requerido' });

  const supabaseUrl         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey      = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey             = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  }

  // Cliente con anon key para verificar el JWT del solicitante
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
    return res.status(403).json({ error: 'Solo el administrador puede crear alumnos' });
  }

  // ── Crear el usuario ────────────────────────────────────────────────────────
  const { nombre, apellido, email, telefono } = req.body || {};

  if (!nombre || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const tempPassword = generarPassword();

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password: tempPassword,
    email_confirm: true,          // activa sin necesidad de confirmar email
    user_metadata: {
      nombre: nombre.trim(),
      apellido: (apellido || '').trim(),
      telefono: (telefono || '').trim(),
    },
  });

  if (createError) {
    console.error('[crear-alumno] Error de Supabase createUser:', createError.message, createError);

    const msgLower = createError.message.toLowerCase();
    const yaExiste =
      msgLower.includes('already registered') ||
      msgLower.includes('already exists') ||
      msgLower.includes('user already') ||
      msgLower.includes('email already') ||
      msgLower.includes('duplicate') ||
      createError.status === 422;

    const msg = yaExiste
      ? 'Ya existe un usuario con ese email'
      : `Error al crear el usuario: ${createError.message}`;

    return res.status(400).json({ error: msg });
  }

  await adminClient.from('perfiles').upsert({
    id: newUser.user.id,
    nombre: nombre.trim(),
    apellido: (apellido || '').trim(),
    email: email.toLowerCase().trim(),
    telefono: (telefono || '').trim() || null,
    rol: 'estudiante',
    activo: true,
    ultima_password: tempPassword,
  }, { onConflict: 'id' });

  return res.status(200).json({
    success: true,
    tempPassword,
    userId: newUser.user.id,
    message: 'Alumno creado correctamente',
  });
}
