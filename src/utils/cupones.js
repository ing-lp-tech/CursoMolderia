import { supabase } from '../lib/supabase';

// ─── Mapper: DB row → JS object ─────────────────────────────────────────────
function fromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    description: row.description,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    active: row.active,
    isFlash: row.is_flash,
    created_at: row.created_at,
  };
}

// ─── Mapper: JS object → DB payload ─────────────────────────────────────────
function toDB(obj) {
  const payload = {};
  if ('code' in obj)        payload.code        = obj.code;
  if ('type' in obj)        payload.type        = obj.type;
  if ('value' in obj)       payload.value       = Number(obj.value);
  if ('description' in obj) payload.description = obj.description || null;
  if ('expiresAt' in obj)   payload.expires_at  = obj.expiresAt || null;
  if ('maxUses' in obj)     payload.max_uses    = Number(obj.maxUses) || 0;
  if ('usedCount' in obj)   payload.used_count  = Number(obj.usedCount) || 0;
  if ('active' in obj)      payload.active      = obj.active;
  if ('isFlash' in obj)     payload.is_flash    = obj.isFlash || false;
  return payload;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getCupones() {
  const { data, error } = await supabase
    .from('cupones')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB);
}

export async function addCupon(cupon) {
  const { data, error } = await supabase
    .from('cupones')
    .insert([toDB(cupon)])
    .select()
    .single();
  if (error) throw error;
  return fromDB(data);
}

export async function updateCupon(id, updates) {
  const { error } = await supabase
    .from('cupones')
    .update(toDB(updates))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCupon(id) {
  const { error } = await supabase.from('cupones').delete().eq('id', id);
  if (error) throw error;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export async function validateCupon(code, basePrice) {
  const { data: row, error } = await supabase
    .from('cupones')
    .select('*')
    .ilike('code', code.trim())
    .eq('active', true)
    .maybeSingle();

  if (error || !row) return { valid: false, error: 'Cupón no válido o inactivo' };

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, error: 'Este cupón ha expirado' };
  }

  if (row.max_uses > 0 && row.used_count >= row.max_uses) {
    return { valid: false, error: 'Este cupón ya alcanzó su límite de usos' };
  }

  const cupon = fromDB(row);
  const discount =
    cupon.type === 'percentage'
      ? Math.round(basePrice * cupon.value / 100)
      : cupon.value;

  const finalPrice = Math.max(0, basePrice - discount);
  const label =
    cupon.type === 'percentage'
      ? `${cupon.value}% OFF`
      : `$${Number(discount).toLocaleString('es-AR')} OFF`;

  return { valid: true, cupon, discount, finalPrice, label };
}

// Atomic increment via SQL function (see supabase SQL editor)
export async function useCupon(id) {
  await supabase.rpc('increment_cupon_used_count', { cupon_id: id });
}

// ─── Flash Promo ──────────────────────────────────────────────────────────────

export async function getActiveFlashPromo() {
  const { data } = await supabase
    .from('cupones')
    .select('*')
    .eq('active', true)
    .eq('is_flash', true)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return fromDB(data);
}
