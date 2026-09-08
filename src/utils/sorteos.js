import { supabase } from '../lib/supabase';
import { registrarAuditoria } from './auditoria';

export const PREMIO_DEFAULT = 'Curso gratuito de Audaces';

// ─── Mapper: DB row → JS object ─────────────────────────────────────────────
function fromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    titulo: row.titulo,
    premio: row.premio,
    periodo: row.periodo || '',
    descripcion: row.descripcion || '',
    cantidadGanadores: row.cantidad_ganadores,
    participantes: Array.isArray(row.participantes) ? row.participantes : [],
    // El público no recibe la lista de nombres, solo el contador de la columna generada
    totalParticipantes: row.total_participantes ?? (Array.isArray(row.participantes) ? row.participantes.length : 0),
    ganadores: Array.isArray(row.ganadores) ? row.ganadores : [],
    estado: row.estado,
    publicado: row.publicado,
    realizadoEn: row.realizado_en,
    creadoEn: row.creado_en,
  };
}

// ─── Mapper: JS object → DB payload ─────────────────────────────────────────
function toDB(obj) {
  const payload = {};
  if ('titulo' in obj)            payload.titulo             = obj.titulo;
  if ('premio' in obj)            payload.premio             = obj.premio || PREMIO_DEFAULT;
  if ('periodo' in obj)           payload.periodo            = obj.periodo || null;
  if ('descripcion' in obj)       payload.descripcion        = obj.descripcion || null;
  if ('cantidadGanadores' in obj) payload.cantidad_ganadores = Number(obj.cantidadGanadores) || 1;
  if ('participantes' in obj)     payload.participantes      = obj.participantes || [];
  if ('ganadores' in obj)         payload.ganadores          = obj.ganadores || [];
  if ('estado' in obj)            payload.estado             = obj.estado;
  if ('publicado' in obj)         payload.publicado          = obj.publicado;
  if ('realizadoEn' in obj)       payload.realizado_en       = obj.realizadoEn || null;
  return payload;
}

// ─── Sorteo aleatorio ────────────────────────────────────────────────────────

/**
 * Entero aleatorio en [0, max) usando crypto, descartando el rango sobrante
 * para que no haya sesgo por el módulo (todos los participantes equiprobables).
 */
function randomInt(max) {
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limite);
  return v % max;
}

/**
 * Elige `cantidad` ganadores únicos de la lista de participantes.
 * Fisher-Yates parcial: cada posición sorteada sale del pool, así nadie se repite.
 */
export function sortearGanadores(participantes, cantidad) {
  const pool = [...participantes];
  const total = Math.min(Number(cantidad) || 1, pool.length);
  const ganadores = [];
  for (let i = 0; i < total; i++) {
    const idx = randomInt(pool.length);
    ganadores.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return ganadores;
}

/** Normaliza el texto del textarea en una lista limpia y sin duplicados. */
export function parsearParticipantes(texto) {
  const vistos = new Set();
  return texto
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => {
      if (!s) return false;
      const clave = s.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
}

/** Genera una lista de números correlativos (para sortear por número de inscripción). */
export function generarRango(desde, hasta) {
  const a = Number(desde);
  const b = Number(hasta);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  const total = Math.min(b - a + 1, 5000); // tope de seguridad
  return Array.from({ length: total }, (_, i) => String(a + i));
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getSorteos() {
  const { data, error } = await supabase
    .from('sorteos')
    .select('*')
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDB);
}

export async function addSorteo(sorteo) {
  const { data, error } = await supabase
    .from('sorteos')
    .insert([toDB(sorteo)])
    .select()
    .single();
  if (error) throw error;
  await registrarAuditoria({
    tabla: 'sorteos',
    registroId: data.id,
    accion: 'creacion',
    descripcion: `Sorteo creado: ${data.titulo}`,
    datosNuevos: data,
  });
  return fromDB(data);
}

export async function updateSorteo(id, updates) {
  const { data, error } = await supabase
    .from('sorteos')
    .update(toDB(updates))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromDB(data);
}

export async function deleteSorteo(id, sorteo = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('sorteos')
    .update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: user?.id || null,
      eliminado_por_email: user?.email || null,
      publicado: false,
    })
    .eq('id', id);
  if (error) throw error;
  await registrarAuditoria({
    tabla: 'sorteos',
    registroId: id,
    accion: 'eliminacion',
    descripcion: `Sorteo enviado a papelera: ${sorteo?.titulo || id}`,
    datosAnteriores: sorteo,
  });
}

/**
 * Ejecuta el sorteo y guarda el resultado.
 * Devuelve el sorteo actualizado con sus ganadores.
 */
export async function ejecutarSorteo(sorteo) {
  if (!sorteo.participantes.length) throw new Error('El sorteo no tiene participantes cargados');
  const ganadores = sortearGanadores(sorteo.participantes, sorteo.cantidadGanadores);
  const actualizado = await updateSorteo(sorteo.id, {
    ganadores,
    estado: 'realizado',
    realizadoEn: new Date().toISOString(),
  });
  await registrarAuditoria({
    tabla: 'sorteos',
    registroId: sorteo.id,
    accion: 'modificacion',
    descripcion: `Sorteo realizado: ${sorteo.titulo} — ganador(es): ${ganadores.join(', ')}`,
    datosNuevos: { ganadores, participantes: sorteo.participantes.length },
  });
  return actualizado;
}

/**
 * Publica un sorteo en la portada. Solo uno queda publicado a la vez:
 * primero baja los demás, después sube este.
 */
export async function publicarSorteo(id) {
  const { error: errOff } = await supabase
    .from('sorteos')
    .update({ publicado: false })
    .eq('publicado', true)
    .neq('id', id);
  if (errOff) throw errOff;
  return updateSorteo(id, { publicado: true });
}

export async function despublicarSorteo(id) {
  return updateSorteo(id, { publicado: false });
}

/**
 * Lectura pública: el sorteo que está publicado en la portada (o null).
 * Pide columnas explícitas — el rol `anon` no tiene permiso sobre `participantes`,
 * así que un `select *` fallaría (y expondría los nombres si lo tuviera).
 */
export async function getSorteoPublicado() {
  const { data, error } = await supabase
    .from('sorteos')
    .select('id, titulo, premio, periodo, descripcion, cantidad_ganadores, ganadores, realizado_en, total_participantes')
    // El filtro por eliminado_en lo aplica la política RLS: `anon` no tiene
    // permiso de lectura sobre esa columna y filtrarla acá daría error.
    .eq('publicado', true)
    .eq('estado', 'realizado')
    .order('realizado_en', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.length ? fromDB(data[0]) : null;
}
