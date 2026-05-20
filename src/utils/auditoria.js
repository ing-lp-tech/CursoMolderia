import { supabase } from '../lib/supabase';

/**
 * Registra una acción en la tabla de auditoría.
 * Falla silenciosamente para no interrumpir el flujo normal.
 */
export async function registrarAuditoria({
  tabla,
  registroId,
  accion,
  descripcion = null,
  datosAnteriores = null,
  datosNuevos = null,
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('auditoria').insert({
      tabla_origen:        tabla,
      registro_id:         String(registroId),
      accion,
      descripcion,
      datos_anteriores:    datosAnteriores,
      datos_nuevos:        datosNuevos,
      realizado_por:       user.id,
      realizado_por_email: user.email,
    });
  } catch (e) {
    console.error('[auditoria]', e?.message);
  }
}
