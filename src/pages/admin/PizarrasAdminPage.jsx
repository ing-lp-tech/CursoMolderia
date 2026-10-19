import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { registrarAuditoria } from '../../utils/auditoria';
import { imgUrl, uploadImagen } from '../../utils/imagenesProducto';
import SlotImagen from '../../components/SlotImagen';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { linkSeguimiento, normalizarCodigo, CODIGO_RE } from '../../utils/software';

const SUPER_ADMIN  = 'ing.lp.tech@gmail.com';
function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Lee la respuesta de /api sin romperse si no vino JSON.
//
// Cuando el endpoint no existe —en `npm run dev`, si falta en la lista de
// vite.config.js, o en un deploy a medio subir— el server devuelve el HTML de
// la SPA, y res.json() tira "Unexpected end of JSON input", que no dice nada
// sobre la causa. Acá se cambia por un mensaje que sí orienta.
async function respuestaJson(res, queHacia) {
  const texto = await res.text();
  if (!texto) {
    throw new Error(`El servidor no devolvió respuesta al ${queHacia} (HTTP ${res.status}).`);
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(
      `El endpoint /api/producto-admin no respondió JSON al ${queHacia} (HTTP ${res.status}). ` +
      `Si estás en localhost, revisá que la ruta esté en la lista de vite.config.js.`
    );
  }
}

// Esta pantalla es el sector propio de las pizarras: `productos` guarda también
// plotters, PCs y accesorios, así que se acota a la categoría "Pizarras".
async function idCategoriaPizarras() {
  const { data } = await supabase
    .from('producto_categorias')
    .select('id')
    .eq('slug', 'pizarras')
    .maybeSingle();
  return data?.id || null;
}

// ════════════════════════════════════════════════════════════════
// TAB PRODUCTOS
// ════════════════════════════════════════════════════════════════

const FORM_INICIAL = {
  titulo: '', descripcion: '', especificaciones: '',
  precio: '400000', stock: '10', orden: 0, activo: true,
  peso_kg: '4', alto_cm: '10', ancho_cm: '50', largo_cm: '80',
};

function TabProductos() {
  const [pizarras, setPizarras] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  const [imgs,     setImgs]     = useState([null, null, null]);
  const [imgBlobs, setImgBlobs] = useState([null, null, null]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const categoriaId = await idCategoriaPizarras();
    let query = supabase.from('productos').select('*').is('eliminado_en', null).order('orden');
    if (categoriaId) query = query.eq('categoria_id', categoriaId);
    const { data } = await query;
    setPizarras(data || []);
    setLoading(false);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_INICIAL, orden: pizarras.length });
    setImgs([null, null, null]); setImgBlobs([null, null, null]);
    setError(''); setShowModal(true);
  }

  function abrirEditar(p) {
    setEditando(p);
    setForm({
      titulo: p.titulo, descripcion: p.descripcion || '', especificaciones: p.especificaciones || '',
      precio: p.precio, stock: p.stock, orden: p.orden, activo: p.activo,
      peso_kg: p.peso_kg, alto_cm: p.alto_cm, ancho_cm: p.ancho_cm, largo_cm: p.largo_cm,
    });
    setImgs([null, null, null]); setImgBlobs([null, null, null]);
    setError(''); setShowModal(true);
  }

  function setImgSlot(slot, file, blob) {
    setImgs(prev  => { const n = [...prev];  n[slot] = file; return n; });
    setImgBlobs(prev => { const n = [...prev]; n[slot] = blob; return n; });
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return; }
    if (!form.precio)        { setError('El precio es obligatorio'); return; }
    setGuardando(true); setError('');

    try {
      const pizarraId = editando?.id || crypto.randomUUID();

      const paths = [
        editando?.imagen_1_path || null,
        editando?.imagen_2_path || null,
        editando?.imagen_3_path || null,
      ];
      const thumbs = [
        editando?.thumb_1_path || null,
        editando?.thumb_2_path || null,
        editando?.thumb_3_path || null,
      ];
      // Esta pantalla es el sector de pizarras, así que la carpeta es siempre
      // la misma; es el mismo slug que busca idCategoriaPizarras().
      for (let i = 0; i < 3; i++) {
        if (!imgBlobs[i]) continue;
        const subida = await uploadImagen(imgs[i], pizarraId, i + 1, 'pizarras');
        paths[i]  = subida.imagen_path;
        thumbs[i] = subida.thumb_path;
      }

      const payload = {
        titulo:           form.titulo.trim(),
        descripcion:      form.descripcion.trim() || null,
        especificaciones: form.especificaciones.trim() || null,
        precio:           Number(form.precio),
        stock:            Number(form.stock) || 0,
        activo:           form.activo,
        orden:            Number(form.orden) || 0,
        peso_kg:          Number(form.peso_kg) || 1,
        alto_cm:          Number(form.alto_cm) || 10,
        ancho_cm:         Number(form.ancho_cm) || 40,
        largo_cm:         Number(form.largo_cm) || 60,
        imagen_1_path:    paths[0],
        imagen_2_path:    paths[1],
        imagen_3_path:    paths[2],
        thumb_1_path:     thumbs[0],
        thumb_2_path:     thumbs[1],
        thumb_3_path:     thumbs[2],
      };

      const { error: err } = editando
        ? await supabase.from('productos').update(payload).eq('id', editando.id)
        : await supabase.from('productos').insert({
            id: pizarraId,
            categoria_id: await idCategoriaPizarras(),
            ...payload,
          });

      if (err) { setError(err.message); return; }
      setShowModal(false);
      cargar();
    } catch (ex) {
      setError(ex?.message || 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(p) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    setPizarras(prev => prev.map(x => x.id === p.id ? { ...x, activo: !p.activo } : x));
  }

  async function eliminar(p) {
    if (!confirm(`¿Enviar "${p.titulo}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('productos').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', p.id);
    await registrarAuditoria({ tabla: 'productos', registroId: p.id, accion: 'eliminacion', descripcion: `Pizarra "${p.titulo}" enviada a papelera`, datosAnteriores: p });
    setPizarras(prev => prev.filter(x => x.id !== p.id));
  }

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-sm">add</span>Nueva pizarra
        </button>
      </div>

      <div className="space-y-2">
        {pizarras.map(p => {
          const portada = imgUrl(p.thumb_1_path || p.imagen_1_path);
          return (
            <div key={p.id} className={`flex items-center gap-3 p-3 border border-outline-variant/20 rounded-xl transition-all ${!p.activo ? 'opacity-50' : ''}`}>
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-surface-variant flex items-center justify-center">
                {portada
                  ? <img src={portada} alt="" className="w-full h-full object-cover" />
                  : <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl">draw</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{p.titulo}</p>
                <p className="text-xs text-on-surface-variant">Stock: {p.stock} · {p.peso_kg}kg · {p.largo_cm}×{p.ancho_cm}×{p.alto_cm}cm</p>
                <p className="text-sm font-headline font-bold text-primary">${fmt(p.precio)}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <button onClick={() => toggleActivo(p)} title={p.activo ? 'Ocultar' : 'Mostrar'}
                  className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">{p.activo ? 'visibility' : 'visibility_off'}</span>
                </button>
                <button onClick={() => abrirEditar(p)}
                  className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button onClick={() => eliminar(p)}
                  className="p-1.5 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          );
        })}
        {pizarras.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">draw</span>
            <p className="text-on-surface-variant">Sin pizarras todavía</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={handleGuardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editando ? 'Editar pizarra' : 'Nueva pizarra'}</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Título *</label>
              <input type="text" required value={form.titulo} className="input-field"
                placeholder="Ej: Pizarra Digitalizadora Profesional"
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción</label>
              <textarea value={form.descripcion} rows={3} className="input-field resize-none"
                placeholder="Descripción general del producto"
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Especificaciones (una por línea)</label>
              <textarea value={form.especificaciones} rows={4} className="input-field resize-none font-mono text-sm"
                placeholder={'Área de digitalización A0\nConexión USB\nCompatible con Audaces'}
                onChange={e => setForm(f => ({ ...f, especificaciones: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Precio (ARS) *</label>
                <input type="number" min={0} step={1000} value={form.precio} className="input-field"
                  onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Stock</label>
                <input type="number" min={0} value={form.stock} className="input-field"
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={form.orden} className="input-field"
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Peso y dimensiones del paquete (para cotizar el envío)
              </p>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Peso (kg)</label>
                  <input type="number" min={0} step={0.1} value={form.peso_kg} className="input-field"
                    onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Largo (cm)</label>
                  <input type="number" min={0} value={form.largo_cm} className="input-field"
                    onChange={e => setForm(f => ({ ...f, largo_cm: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Ancho (cm)</label>
                  <input type="number" min={0} value={form.ancho_cm} className="input-field"
                    onChange={e => setForm(f => ({ ...f, ancho_cm: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">Alto (cm)</label>
                  <input type="number" min={0} value={form.alto_cm} className="input-field"
                    onChange={e => setForm(f => ({ ...f, alto_cm: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Imágenes de preview (máx 3) — se comprimen automáticamente
              </label>
              <div className="flex gap-4 justify-start">
                {[0, 1, 2].map(i => (
                  <SlotImagen
                    key={i}
                    label={i === 0 ? 'Portada *' : `Imagen ${i + 1}`}
                    valor={editando ? [editando.imagen_1_path, editando.imagen_2_path, editando.imagen_3_path][i] : null}
                    onChange={(file, blob) => setImgSlot(i, file, blob)}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer py-1">
              <div onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium">{form.activo ? 'Visible al público' : 'Oculto'}</span>
            </label>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear pizarra'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB VENTAS
// ════════════════════════════════════════════════════════════════

function TabVentas() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN;
  const [compras,    setCompras]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtro,     setFiltro]     = useState('en_verificacion');
  const [aprobando,  setAprobando]  = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [generando,  setGenerando]  = useState(null);
  const [anulando,   setAnulando]   = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [motivoMap,  setMotivoMap]  = useState({});

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from('producto_compras')
      .select('*')
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false });
    setCompras(data || []);
    setLoading(false);
  }

  const comprasFiltradas = compras.filter(c => filtro === 'todas' || c.estado === filtro);

  async function aprobar(compra) {
    setAprobando(compra.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/producto-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ compra_id: compra.id, accion: 'aprobar' }),
      });
      const data = await respuestaJson(res, 'aprobar la compra');
      if (!res.ok) { alert(data.error || 'Error al aprobar'); return; }

      const wa_num = compra.whatsapp.replace(/\D/g, '');

      // Un plan puede ser físico Y traer créditos ("Inicial" se despacha y
      // además incluye digitalizaciones), así que el mensaje se arma por
      // partes en vez de elegir una de tres variantes.
      const cred = data.credito;
      const partes = [`Hola ${compra.nombre}! ✅ Tu pago fue aprobado.`];

      if (compra.direccion_calle) {
        partes.push(compra.metodo_envio === 'coordinar'
          ? `Coordinemos por acá el envío de tu *${compra.titulo_producto}*.`
          : `Ya estamos preparando el envío de tu *${compra.titulo_producto}* por ${compra.envia_carrier}. Te paso el código de seguimiento en cuanto lo generemos.`);
      }

      if (cred) {
        partes.push(
          `Tu código de digitalización es:\n\n*${cred.codigo}*\n\n` +
          `Te sirve para ${cred.creditos} ${cred.creditos === 1 ? 'digitalización' : 'digitalizaciones'}` +
          (cred.extra > 0 ? ` (incluye ${cred.extra} de regalo por pagar con transferencia 🎁).` : '.')
        );
      }

      // Todo plan termina en /software: ahí copia el código y entra al
      // software, cuya dirección se cambia desde Configuración sin tocar esto.
      if (compra.plan_id) {
        partes.push(`Copiá tu código y entrá al software desde acá:\n${linkSeguimiento(compra.id)}`);
      }

      partes.push('¡Gracias por tu compra en Moldi Tex! 🧵');
      const texto = encodeURIComponent(partes.join('\n\n'));
      window.open(`https://wa.me/${wa_num}?text=${texto}`, '_blank');

      setCompras(prev => prev.map(c => c.id === compra.id ? { ...c, estado: 'aprobado' } : c));
    } catch (ex) {
      alert(ex?.message || 'Error inesperado');
    } finally {
      setAprobando(null);
    }
  }

  async function rechazar(compra) {
    const motivo = motivoMap[compra.id] || '';
    if (!confirm(`¿Rechazar la compra de ${compra.nombre}?`)) return;
    setRechazando(compra.id);
    await supabase.from('producto_compras').update({
      estado: 'rechazado', rechazo_motivo: motivo || null,
    }).eq('id', compra.id);
    setCompras(prev => prev.map(c => c.id === compra.id ? { ...c, estado: 'rechazado' } : c));
    setRechazando(null);
  }

  async function generarEnvio(compra) {
    setGenerando(compra.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/producto-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ compra_id: compra.id, accion: 'generar-envio' }),
      });
      const data = await respuestaJson(res, 'generar el envío');
      if (!res.ok) { alert(data.error || 'Error al generar el envío'); return; }
      if (!data.tracking_number) {
        alert('envia.com respondió OK pero no devolvió número de tracking. Revisá los logs de Vercel (ENVIA_GENERATE_RESPONSE) y "Mis Envíos" en shipping.envia.com antes de reintentar, para no generar un envío duplicado.');
      }
      setCompras(prev => prev.map(c => c.id === compra.id ? {
        ...c,
        envia_shipment_id: data.shipment_id,
        envia_tracking_number: data.tracking_number,
        envia_label_url: data.label_url,
        envia_tracking_url: data.tracking_url,
        // Si esta guía reemplaza a una anulada, la ficha vuelve a estado vivo.
        envia_cancelado_en: null,
        envia_cancelado_por_email: null,
        envia_estado: null,
      } : c));
    } catch (ex) {
      alert(ex?.message || 'Error inesperado');
    } finally {
      setGenerando(null);
    }
  }

  async function anularEnvio(compra) {
    if (!confirm(
      `¿Marcar como anulada la guía de ${compra.nombre}?

` +
      `Esto NO cancela nada en envia.com: cancelala allá primero. ` +
      `Acá queda registrada la anulación y vas a poder generar una guía nueva.`
    )) return;
    setAnulando(compra.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/producto-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ compra_id: compra.id, accion: 'anular-envio' }),
      });
      const data = await respuestaJson(res, 'anular la guía');
      if (!res.ok) { alert(data.error || 'Error al anular la guía'); return; }
      setCompras(prev => prev.map(c => c.id === compra.id
        ? { ...c, envia_cancelado_en: new Date().toISOString() }
        : c));
    } catch (ex) {
      alert(ex?.message || 'Error inesperado');
    } finally {
      setAnulando(null);
    }
  }

  async function eliminar(compra) {
    if (!isSuperAdmin) return;
    if (!confirm(`¿Enviar la venta de ${compra.nombre} (${compra.titulo_producto}) a la papelera?`)) return;
    setEliminando(compra.id);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      const { error } = await supabase.from('producto_compras').update({
        eliminado_en: new Date().toISOString(), eliminado_por: u?.id, eliminado_por_email: u?.email,
      }).eq('id', compra.id);
      if (error) { alert(error.message); return; }
      await registrarAuditoria({
        tabla: 'producto_compras', registroId: compra.id, accion: 'eliminacion',
        descripcion: `Venta de "${compra.nombre}" (${compra.titulo_producto}) enviada a papelera`,
        datosAnteriores: compra,
      });
      setCompras(prev => prev.filter(c => c.id !== compra.id));
    } finally {
      setEliminando(null);
    }
  }

  const FILTROS = [
    { key: 'en_verificacion', label: 'En verificación' },
    { key: 'aprobado',        label: 'Aprobadas' },
    { key: 'rechazado',       label: 'Rechazadas' },
    { key: 'todas',           label: 'Todas' },
  ];

  const conteo = key => key === 'todas' ? compras.length : compras.filter(c => c.estado === key).length;

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
              filtro === f.key ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
            }`}>
            {f.label} ({conteo(f.key)})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {comprasFiltradas.map(c => (
          <div key={c.id} className="border border-outline-variant/20 rounded-2xl overflow-hidden">
            <div className={`px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${
              c.estado === 'en_verificacion' ? 'bg-primary/10 text-primary' :
              c.estado === 'aprobado'        ? 'bg-secondary/10 text-secondary' :
              'bg-error/10 text-error'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {c.estado === 'en_verificacion' ? 'hourglass_top' : c.estado === 'aprobado' ? 'check_circle' : 'cancel'}
              </span>
              {c.estado === 'en_verificacion' ? 'En verificación' : c.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
              <span className="ml-auto font-normal normal-case opacity-70">{fmtDate(c.creado_en)}</span>
              {isSuperAdmin && (
                <button onClick={() => eliminar(c)} disabled={eliminando === c.id} title="Eliminar (solo super admin)"
                  className="shrink-0 p-1 rounded-lg hover:bg-error/20 text-error/70 hover:text-error transition-all disabled:opacity-50">
                  <span className={`material-symbols-outlined text-sm ${eliminando === c.id ? 'animate-spin' : ''}`}>
                    {eliminando === c.id ? 'refresh' : 'delete'}
                  </span>
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-bold">{c.nombre}</p>
                  <p className="text-on-surface-variant text-xs">{c.whatsapp}</p>
                  {c.direccion_calle ? (
                    <>
                      <p className="text-on-surface-variant text-xs">
                        {c.direccion_calle} {c.direccion_numero}{c.direccion_piso_depto ? `, ${c.direccion_piso_depto}` : ''}
                      </p>
                      <p className="text-on-surface-variant text-xs">
                        {c.direccion_ciudad}, {c.direccion_provincia} (CP {c.direccion_codigo_postal})
                      </p>
                    </>
                  ) : (
                    <p className="text-on-surface-variant text-xs">Sin dirección: este plan no se despacha</p>
                  )}
                  {c.sucursal_nombre && (
                    <p className="text-on-surface-variant text-xs mt-0.5">
                      🏢 Retira en: {c.sucursal_nombre}{c.sucursal_direccion ? ` — ${c.sucursal_direccion}` : ''}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-bold truncate">
                    {c.titulo_producto}{Number(c.cantidad) > 1 ? ` ×${c.cantidad}` : ''}
                  </p>
                  {c.titulo_plan && (
                    <p className="text-xs text-primary font-bold">Plan: {c.titulo_plan}</p>
                  )}
                  <p className="text-xs text-on-surface-variant">
                    {c.metodo_pago === 'mercadopago' ? '💳 MercadoPago' : '🏦 Transferencia'}
                    · Envío: {!c.direccion_calle
                      ? '— sin envío'
                      : c.metodo_envio === 'coordinar'
                        ? '💬 A coordinar por WhatsApp'
                        : `${c.envia_carrier} — ${c.envia_service_descripcion || c.envia_service} ($${fmt(c.monto_envio)})`
                    }
                  </p>
                  <p className="font-headline font-bold text-primary text-lg">${fmt(c.monto_cobrado)}</p>
                  {c.rechazo_motivo && <p className="text-xs text-error mt-1">Motivo: {c.rechazo_motivo}</p>}
                </div>
              </div>

              {c.estado === 'en_verificacion' && (
                <div className="space-y-2 pt-1 border-t border-outline-variant/10">
                  <input
                    type="text"
                    placeholder="Motivo de rechazo (opcional)"
                    value={motivoMap[c.id] || ''}
                    onChange={e => setMotivoMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className="input-field text-sm py-2"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => rechazar(c)} disabled={rechazando === c.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-error/10 text-error text-sm font-bold hover:bg-error/20 transition-all disabled:opacity-50">
                      <span className="material-symbols-outlined text-base">cancel</span>
                      {rechazando === c.id ? 'Rechazando…' : 'Rechazar'}
                    </button>
                    <button onClick={() => aprobar(c)} disabled={aprobando === c.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/15 text-secondary text-sm font-bold hover:bg-secondary/25 transition-all disabled:opacity-50">
                      {aprobando === c.id
                        ? <><span className="material-symbols-outlined text-base animate-spin">refresh</span>Aprobando…</>
                        : <><span className="material-symbols-outlined text-base">check_circle</span>Aprobar y avisar por WhatsApp</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {c.estado === 'aprobado' && !c.direccion_calle && (
                <div className="pt-1 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-sm bg-secondary/10 rounded-xl p-3 text-secondary">
                    <span className="material-symbols-outlined text-base">key</span>
                    Sin envío: el código de digitalización se entrega por WhatsApp (mirá la pestaña Créditos).
                  </div>
                </div>
              )}

              {c.estado === 'aprobado' && c.direccion_calle && c.metodo_envio === 'coordinar' && (
                <div className="pt-1 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-sm bg-secondary/10 rounded-xl p-3 text-secondary">
                    <span className="material-symbols-outlined text-base">chat</span>
                    Envío a coordinar directamente por WhatsApp con el cliente.
                  </div>
                </div>
              )}

              {c.estado === 'aprobado' && c.direccion_calle && c.metodo_envio !== 'coordinar' && (
                <div className="pt-1 border-t border-outline-variant/10">
                  {c.envia_tracking_number && !c.envia_cancelado_en ? (
                    <div className="flex items-center justify-between gap-2 text-sm bg-secondary/10 rounded-xl p-3 flex-wrap">
                      <div>
                        <p className="font-bold text-secondary">Envío generado</p>
                        <p className="text-xs text-on-surface-variant font-mono">Tracking: {c.envia_tracking_number}</p>
                        {c.envia_estado && (
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Estado: <span className="font-bold">{c.envia_estado}</span>
                            {c.envia_estado_actualizado_en && ` · ${fmtDate(c.envia_estado_actualizado_en)}`}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        {c.envia_tracking_url && (
                          <a href={c.envia_tracking_url} target="_blank" rel="noreferrer"
                            className="btn-secondary text-xs py-2 px-3">Ver seguimiento</a>
                        )}
                        {c.envia_label_url && (
                          <a href={c.envia_label_url} target="_blank" rel="noreferrer"
                            className="btn-secondary text-xs py-2 px-3">Ver etiqueta</a>
                        )}
                        <button onClick={() => anularEnvio(c)} disabled={anulando === c.id}
                          className="text-xs py-2 px-3 rounded-xl bg-error/10 text-error font-bold hover:bg-error/20 transition-all disabled:opacity-50">
                          {anulando === c.id ? 'Anulando…' : 'Anular guía'}
                        </button>
                      </div>
                    </div>
                  ) : c.envia_cancelado_en ? (
                    <div className="space-y-2">
                      <div className="text-sm bg-error/10 rounded-xl p-3">
                        <p className="font-bold text-error">Guía anulada</p>
                        <p className="text-xs text-on-surface-variant">
                          {fmtDate(c.envia_cancelado_en)}
                          {c.envia_cancelado_por_email ? ` · ${c.envia_cancelado_por_email}` : ''}
                        </p>
                        {c.envia_tracking_number && (
                          <p className="text-xs text-on-surface-variant font-mono line-through opacity-70">
                            Tracking anulado: {c.envia_tracking_number}
                          </p>
                        )}
                      </div>
                      <button onClick={() => generarEnvio(c)} disabled={generando === c.id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/15 text-primary text-sm font-bold hover:bg-primary/25 transition-all disabled:opacity-50">
                        {generando === c.id
                          ? <><span className="material-symbols-outlined text-base animate-spin">refresh</span>Generando envío…</>
                          : <><span className="material-symbols-outlined text-base">local_shipping</span>Generar una guía nueva</>
                        }
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => generarEnvio(c)} disabled={generando === c.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/15 text-primary text-sm font-bold hover:bg-primary/25 transition-all disabled:opacity-50">
                      {generando === c.id
                        ? <><span className="material-symbols-outlined text-base animate-spin">refresh</span>Generando envío…</>
                        : <><span className="material-symbols-outlined text-base">local_shipping</span>Generar guía de envío (envia.com)</>
                      }
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {comprasFiltradas.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">shopping_bag</span>
            <p className="text-on-surface-variant">Sin ventas en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB PLANES
//
// Los 4 planes de la pizarra viven en `producto_planes`: cambiarles el
// precio o lo que incluyen es una edición acá, sin deploy.
// ════════════════════════════════════════════════════════════════

const PLAN_INICIAL = {
  producto_id: '', nombre: '', descripcion: '', incluye: '',
  precio: '0', precio_sufijo: '',
  requiere_envio: true, otorga_creditos: false, creditos_por_unidad: 1,
  cantidad_min: 1, cantidad_max: 1,
  destacado: false, orden: 0, activo: true,
};

function TabPlanes() {
  const [productos, setProductos] = useState([]);
  const [planes,    setPlanes]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(PLAN_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const categoriaId = await idCategoriaPizarras();
    let q = supabase.from('productos').select('id, titulo').is('eliminado_en', null).order('orden');
    if (categoriaId) q = q.eq('categoria_id', categoriaId);
    const { data: prods } = await q;
    setProductos(prods || []);

    if (prods?.length) {
      const { data } = await supabase
        .from('producto_planes')
        .select('*')
        .in('producto_id', prods.map(p => p.id))
        .is('eliminado_en', null)
        .order('orden');
      setPlanes(data || []);
    } else {
      setPlanes([]);
    }
    setLoading(false);
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...PLAN_INICIAL, producto_id: productos[0]?.id || '' });
    setError('');
    setShowModal(true);
  }

  function abrirEditar(pl) {
    setEditando(pl);
    setForm({
      producto_id: pl.producto_id,
      nombre: pl.nombre || '',
      descripcion: pl.descripcion || '',
      incluye: pl.incluye || '',
      precio: String(pl.precio ?? '0'),
      precio_sufijo: pl.precio_sufijo || '',
      requiere_envio: pl.requiere_envio,
      otorga_creditos: pl.otorga_creditos,
      creditos_por_unidad: pl.creditos_por_unidad ?? 1,
      cantidad_min: pl.cantidad_min,
      cantidad_max: pl.cantidad_max,
      destacado: pl.destacado,
      orden: pl.orden,
      activo: pl.activo,
    });
    setError('');
    setShowModal(true);
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const min = Math.max(1, Number(form.cantidad_min) || 1);
      const max = Math.max(min, Number(form.cantidad_max) || min);

      const payload = {
        producto_id:     form.producto_id,
        nombre:          form.nombre.trim(),
        descripcion:     form.descripcion.trim() || null,
        incluye:         form.incluye.trim() || null,
        precio:          Number(form.precio) || 0,
        precio_sufijo:   form.precio_sufijo.trim() || null,
        requiere_envio:  !!form.requiere_envio,
        otorga_creditos: !!form.otorga_creditos,
        creditos_por_unidad: Math.max(1, Number(form.creditos_por_unidad) || 1),
        cantidad_min:    min,
        cantidad_max:    max,
        destacado:       !!form.destacado,
        orden:           Number(form.orden) || 0,
        activo:          !!form.activo,
      };

      if (!payload.producto_id) { setError('Elegí a qué producto pertenece el plan'); return; }

      const { error: err } = editando
        ? await supabase.from('producto_planes').update(payload).eq('id', editando.id)
        : await supabase.from('producto_planes').insert(payload);

      if (err) { setError(err.message); return; }
      setShowModal(false);
      await cargar();
    } catch (ex) {
      setError(ex?.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(pl) {
    await supabase.from('producto_planes').update({ activo: !pl.activo }).eq('id', pl.id);
    setPlanes(prev => prev.map(x => x.id === pl.id ? { ...x, activo: !pl.activo } : x));
  }

  async function eliminar(pl) {
    if (!confirm(`¿Enviar el plan "${pl.nombre}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('producto_planes').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', pl.id);
    await registrarAuditoria({
      tabla: 'producto_planes', registroId: pl.id, accion: 'eliminacion',
      descripcion: `Plan "${pl.nombre}" enviado a papelera`, datosAnteriores: pl,
    });
    setPlanes(prev => prev.filter(x => x.id !== pl.id));
  }

  const tituloProducto = id => productos.find(p => p.id === id)?.titulo || '—';

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          Los precios que ve el cliente en <span className="font-mono">/pizarras</span> salen de acá.
        </p>
        <button onClick={abrirNuevo} disabled={!productos.length} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
          <span className="material-symbols-outlined text-base align-middle mr-1">add</span>Nuevo plan
        </button>
      </div>

      <div className="space-y-2">
        {planes.map(pl => (
          <div key={pl.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
            pl.activo ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-60'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm">{pl.nombre}</p>
                {pl.destacado && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/20 text-secondary rounded-full px-2 py-0.5">Destacado</span>
                )}
                {pl.otorga_creditos && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary rounded-full px-2 py-0.5">
                    {(pl.creditos_por_unidad ?? 1) > 1 ? `${pl.creditos_por_unidad} créditos c/u` : 'Créditos'}
                  </span>
                )}
                {!pl.requiere_envio && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-surface-variant text-on-surface-variant rounded-full px-2 py-0.5">Sin envío</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant truncate">{tituloProducto(pl.producto_id)}</p>
              <p className="text-sm font-headline font-bold text-primary">
                ${fmt(pl.precio)}{pl.precio_sufijo ? <span className="text-xs font-normal text-on-surface-variant"> {pl.precio_sufijo}</span> : null}
                {pl.cantidad_max > pl.cantidad_min && (
                  <span className="text-xs font-normal text-on-surface-variant"> · {pl.cantidad_min} a {pl.cantidad_max}</span>
                )}
              </p>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => toggleActivo(pl)} title={pl.activo ? 'Ocultar' : 'Mostrar'}
                className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">{pl.activo ? 'visibility' : 'visibility_off'}</span>
              </button>
              <button onClick={() => abrirEditar(pl)}
                className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button onClick={() => eliminar(pl)}
                className="p-1.5 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
        ))}

        {planes.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">sell</span>
            <p className="text-on-surface-variant">Sin planes todavía</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={handleGuardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editando ? 'Editar plan' : 'Nuevo plan'}</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Producto *</label>
              <select required value={form.producto_id} className="input-field"
                onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))}>
                <option value="">Elegí el producto</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre *</label>
              <input type="text" required value={form.nombre} className="input-field" placeholder="Ej: Combo Taller"
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Bajada</label>
              <input type="text" value={form.descripcion} className="input-field" placeholder="Una línea corta"
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Incluye (uno por línea)</label>
              <textarea value={form.incluye} rows={4} className="input-field resize-none font-mono text-sm"
                placeholder={'Pizarra digitalizadora\nSoftware de digitalización\nSoporte de instalación'}
                onChange={e => setForm(f => ({ ...f, incluye: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Precio *</label>
                <input type="number" min={0} step={1000} value={form.precio} className="input-field"
                  onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Sufijo</label>
                <input type="text" value={form.precio_sufijo} className="input-field" placeholder="por crédito"
                  onChange={e => setForm(f => ({ ...f, precio_sufijo: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={form.orden} className="input-field"
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Cantidad mínima</label>
                <input type="number" min={1} value={form.cantidad_min} className="input-field"
                  onChange={e => setForm(f => ({ ...f, cantidad_min: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Cantidad máxima</label>
                <input type="number" min={1} value={form.cantidad_max} className="input-field"
                  onChange={e => setForm(f => ({ ...f, cantidad_max: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-on-surface-variant -mt-2">
              Si el máximo es mayor que el mínimo, el comprador elige la cantidad (así funcionan los créditos).
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, requiere_envio: !f.requiere_envio }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.requiere_envio ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiere_envio ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.requiere_envio ? 'Se despacha (pide dirección)' : 'Sin envío (no pide dirección)'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, otorga_creditos: !f.otorga_creditos }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.otorga_creditos ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.otorga_creditos ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">
                  {form.otorga_creditos ? 'Al aprobar, emite un código de digitalización' : 'No emite código'}
                </span>
              </label>

              {form.otorga_creditos && (
                <div className="pl-14">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                    Créditos por unidad
                  </label>
                  <input type="number" min={1} value={form.creditos_por_unidad} className="input-field"
                    onChange={e => setForm(f => ({ ...f, creditos_por_unidad: e.target.value }))} />
                  <p className="text-xs text-on-surface-variant mt-1">
                    Cuántas digitalizaciones entrega cada unidad comprada. Una pizarra que
                    incluye 10 digitalizaciones va con 10; los créditos sueltos van con 1.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, destacado: !f.destacado }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.destacado ? 'bg-secondary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.destacado ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.destacado ? 'Destacado en la página' : 'Sin destacar'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">{form.activo ? 'Visible al público' : 'Oculto'}</span>
              </label>
            </div>

            {error && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB CRÉDITOS
//
// Todos los códigos, de los tres orígenes:
//   compra → emitido al aprobar una venta real
//   manual → creado acá para un cliente (cortesía, pago por alias…)
//   demo   → creado acá para mostrar el software
//
// Se gastan desde el software (/api/digitalizacion), desde la cola de
// digitalizaciones o a mano desde acá. Cada cosa que le pasa a un código
// queda en `credito_movimientos` (script 13): lo anota un trigger de la
// base, así que el historial no depende de esta pantalla.
// ════════════════════════════════════════════════════════════════

async function traerCreditos() {
  const { data } = await supabase
    .from('digitalizacion_creditos')
    .select('*')
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });
  return data || [];
}

function estaVencido(c) {
  return !!c.vence_en && new Date(c.vence_en) <= new Date();
}

const ORIGENES_CODIGO = {
  compra: { label: 'Compra', icon: 'shopping_cart', clase: 'bg-secondary/15 text-secondary' },
  manual: { label: 'Manual', icon: 'person',        clase: 'bg-tertiary/15 text-tertiary' },
  demo:   { label: 'Demo',   icon: 'science',       clase: 'bg-primary/15 text-primary' },
};

// Antes del script 13 la columna `origen` no existe: se deduce de si hay compra.
function origenDe(c) {
  return c.origen || (c.compra_id ? 'compra' : 'manual');
}

function ChipOrigen({ origen }) {
  const o = ORIGENES_CODIGO[origen] || ORIGENES_CODIGO.manual;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${o.clase}`}>
      <span className="material-symbols-outlined text-xs">{o.icon}</span>{o.label}
    </span>
  );
}

// ── Historial ───────────────────────────────────────────────────

const TIPOS_MOVIMIENTO = {
  emision:      { label: 'Emitido',          icon: 'add_circle',    clase: 'text-secondary' },
  uso:          { label: 'Uso',              icon: 'remove_circle', clase: 'text-primary' },
  devolucion:   { label: 'Devolución',       icon: 'undo',          clase: 'text-tertiary' },
  ajuste:       { label: 'Cambio de límite', icon: 'tune',          clase: 'text-on-surface' },
  anulacion:    { label: 'Anulado',          icon: 'block',         clase: 'text-error' },
  reactivacion: { label: 'Reactivado',       icon: 'restart_alt',   clase: 'text-secondary' },
  eliminacion:  { label: 'Eliminado',        icon: 'delete',        clase: 'text-error' },
};

const ORIGENES_MOVIMIENTO = {
  compra:   'Compra aprobada',
  panel:    'Panel',
  software: 'Software',
  cola:     'Cola de digitalización',
  sistema:  'Sistema',
};

function cantidadMovimiento(m) {
  if (!m.cantidad) return null;
  if (m.tipo === 'uso') return `−${m.cantidad}`;
  if (m.tipo === 'devolucion' || m.tipo === 'emision') return `+${m.cantidad}`;
  if (m.tipo === 'ajuste') return m.cantidad > 0 ? `+${m.cantidad}` : `−${Math.abs(m.cantidad)}`;
  return null;
}

// Sin la tabla (script 13 sin correr) el error de PostgREST no orienta;
// este sí.
function mensajeHistorial(error) {
  return /credito_movimientos/.test(error?.message || '')
    ? 'El historial todavía no existe: falta correr el script 13 en Supabase.'
    : (error?.message || 'No se pudo cargar el historial');
}

function FilaMovimiento({ m, conCodigo = false }) {
  const t = TIPOS_MOVIMIENTO[m.tipo] || { label: m.tipo, icon: 'circle', clase: '' };
  const cant = cantidadMovimiento(m);
  const quien = [ORIGENES_MOVIMIENTO[m.origen] || m.origen, m.actor_email].filter(Boolean).join(' · ');
  return (
    <div className="flex items-start gap-3 py-2 border-b border-outline-variant/10 last:border-0 text-xs">
      <span className={`material-symbols-outlined text-lg shrink-0 ${t.clase}`}>{t.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{t.label}</span>
          {cant && <span className={`font-mono font-bold ${t.clase}`}>{cant}</span>}
          {conCodigo && <span className="font-mono text-primary">{m.codigo}</span>}
          {conCodigo && m.credito?.origen && <ChipOrigen origen={m.credito.origen} />}
        </p>
        <p className="text-on-surface-variant">
          {quien}
          {m.referencia && <> · ref <span className="font-mono">{m.referencia.length > 24 ? `${m.referencia.slice(0, 24)}…` : m.referencia}</span></>}
        </p>
        {conCodigo && m.credito?.cliente_nombre && <p className="text-on-surface-variant">{m.credito.cliente_nombre}</p>}
        {m.detalle && <p className="text-on-surface-variant italic">{m.detalle}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-on-surface-variant">{fmtDate(m.creado_en)}</p>
        {m.total_despues != null && (
          <p className="text-[10px] text-on-surface-variant">
            quedan {m.total_despues - (m.usados_despues || 0)} / {m.total_despues}
          </p>
        )}
      </div>
    </div>
  );
}

// El historial de un código, desplegado debajo de su tarjeta.
function HistorialCodigo({ creditoId }) {
  const [movs, setMovs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase
      .from('credito_movimientos')
      .select('*')
      .eq('credito_id', creditoId)
      .order('creado_en', { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (!vivo) return;
        if (err) setError(mensajeHistorial(err));
        else setMovs(data || []);
      });
    return () => { vivo = false; };
  }, [creditoId]);

  if (error) return <p className="text-xs text-error">{error}</p>;
  if (!movs) return <p className="text-xs text-on-surface-variant">Cargando historial…</p>;
  if (movs.length === 0) return <p className="text-xs text-on-surface-variant">Sin movimientos registrados.</p>;
  return <div className="bg-surface-variant/30 rounded-xl px-3">{movs.map(m => <FilaMovimiento key={m.id} m={m} />)}</div>;
}

// Todos los movimientos de todos los códigos, lo más nuevo primero.
function HistorialGeneral() {
  const [movs, setMovs] = useState(null);
  const [error, setError] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [origenCodigo, setOrigenCodigo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase
      .from('credito_movimientos')
      .select('*, credito:digitalizacion_creditos(origen, cliente_nombre)')
      .order('creado_en', { ascending: false })
      .limit(1000)
      .then(({ data, error: err }) => {
        if (!vivo) return;
        if (err) setError(mensajeHistorial(err));
        else setMovs(data || []);
      });
    return () => { vivo = false; };
  }, []);

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!movs) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  const q = busqueda.trim().toLowerCase();
  const visibles = movs.filter(m =>
    (tipo === 'todos' || m.tipo === tipo) &&
    (origenCodigo === 'todos' || m.credito?.origen === origenCodigo) &&
    (!q || [m.codigo, m.credito?.cliente_nombre, m.actor_email, m.referencia].some(v => (v || '').toLowerCase().includes(q)))
  );

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-2">
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="input-field text-sm py-2">
          <option value="todos">Todos los movimientos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <select value={origenCodigo} onChange={e => setOrigenCodigo(e.target.value)} className="input-field text-sm py-2">
          <option value="todos">Códigos de todo origen</option>
          {Object.entries(ORIGENES_CODIGO).map(([k, o]) => <option key={k} value={k}>Códigos de {o.label.toLowerCase()}</option>)}
        </select>
        <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Código, cliente, admin o referencia" className="input-field text-sm py-2" />
      </div>
      <p className="text-xs text-on-surface-variant">
        {visibles.length} movimientos{movs.length === 1000 ? ' (los últimos 1000)' : ''}
      </p>
      <div className="border border-outline-variant/20 rounded-2xl px-4">
        {visibles.map(m => <FilaMovimiento key={m.id} m={m} conCodigo />)}
        {visibles.length === 0 && <p className="text-sm text-on-surface-variant py-8 text-center">Sin movimientos con estos filtros</p>}
      </div>
    </div>
  );
}

// ── Resumen por origen ──────────────────────────────────────────

function ResumenCreditos({ creditos }) {
  const filas = Object.keys(ORIGENES_CODIGO).map(origen => {
    const de = creditos.filter(c => origenDe(c) === origen);
    return {
      origen,
      codigos:   de.length,
      emitidos:  de.reduce((s, c) => s + (c.creditos_total || 0), 0),
      usados:    de.reduce((s, c) => s + (c.creditos_usados || 0), 0),
      restantes: de.reduce((s, c) => s + (c.estado === 'anulado' ? 0 : (c.creditos_restantes || 0)), 0),
    };
  });
  const total = filas.reduce((t, f) => ({
    codigos: t.codigos + f.codigos, emitidos: t.emitidos + f.emitidos,
    usados: t.usados + f.usados, restantes: t.restantes + f.restantes,
  }), { codigos: 0, emitidos: 0, usados: 0, restantes: 0 });

  return (
    <div className="border border-outline-variant/20 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant text-right">
            <th className="text-left font-bold px-4 py-2">Origen</th>
            <th className="font-bold px-3 py-2">Códigos</th>
            <th className="font-bold px-3 py-2">Usos dados</th>
            <th className="font-bold px-3 py-2">Gastados</th>
            <th className="font-bold px-4 py-2">Disponibles</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.origen} className="border-t border-outline-variant/10 text-right">
              <td className="text-left px-4 py-2"><ChipOrigen origen={f.origen} /></td>
              <td className="px-3 py-2">{f.codigos}</td>
              <td className="px-3 py-2">{f.emitidos}</td>
              <td className="px-3 py-2">{f.usados}</td>
              <td className="px-4 py-2 font-bold">{f.restantes}</td>
            </tr>
          ))}
          <tr className="border-t border-outline-variant/30 text-right font-bold">
            <td className="text-left px-4 py-2">Total</td>
            <td className="px-3 py-2">{total.codigos}</td>
            <td className="px-3 py-2">{total.emitidos}</td>
            <td className="px-3 py-2">{total.usados}</td>
            <td className="px-4 py-2">{total.restantes}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Nuevo código (manual o demo) ────────────────────────────────

const NUEVO_CODIGO = {
  tipo: 'manual', codigo: '', cliente_nombre: '', cliente_whatsapp: '', cliente_email: '',
  creditos: '10', vence: '', notas: '', porAlias: false,
};

const DIAS_DEMO = 7;

function fechaEnDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Un código sin compra detrás. "Manual": un cliente (cortesía, canje, pago
// por alias con el comprobante por WhatsApp). "Demo": para mostrar el
// software, con pocos usos y vencimiento corto.
//
// El código, si se deja vacío, lo genera la base (default de la columna),
// igual que en una venta. Si se escribe uno ("DEMO-FERIA"), se usa ese: la
// columna es UNIQUE, así que uno repetido lo rechaza la base y acá se avisa.
function FormNuevoCodigo({ onCreado, onCancelar }) {
  const settings = useAppSettings();
  const extraAlias = Number(settings.transferencia_creditos_extra) || 0;
  const [form, setForm] = useState(NUEVO_CODIGO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const esDemo = form.tipo === 'demo';

  // Una demo arranca con valores de demo; volver a manual los deja como estén.
  function elegirTipo(tipo) {
    setForm(p => tipo === 'demo'
      ? { ...p, tipo, creditos: '3', vence: p.vence || fechaEnDias(DIAS_DEMO), porAlias: false }
      : { ...p, tipo });
  }

  async function guardar(e) {
    e.preventDefault();
    const creditos = Math.trunc(Number(form.creditos));
    if (!Number.isFinite(creditos) || creditos < 1) { setError('La cantidad de usos tiene que ser 1 o más.'); return; }
    const codigo = form.codigo.replace(/^-+|-+$/g, '');
    if (codigo && !CODIGO_RE.test(codigo)) {
      setError('El código tiene que tener de 4 a 32 caracteres: letras, números y guiones.');
      return;
    }
    if (!form.cliente_nombre.trim()) {
      setError(esDemo ? 'Poné para quién o para qué es la demo: después la buscás por ese nombre.' : 'Poné a quién se lo das: después lo buscás por nombre.');
      return;
    }

    // "Usos" es lo que pagó; el regalo por alias se suma acá y queda anotado.
    const extra = !esDemo && form.porAlias ? extraAlias : 0;
    const notas = [
      extra > 0 ? `Pagó por alias: incluye ${extra} de regalo` : (!esDemo && form.porAlias) ? 'Pagó por alias' : '',
      form.notas.trim(),
    ].filter(Boolean).join(' · ');

    const fila = {
      cliente_nombre:   form.cliente_nombre.trim().slice(0, 200),
      cliente_whatsapp: form.cliente_whatsapp.replace(/\D/g, '') || null,
      cliente_email:    form.cliente_email.trim() || null,
      creditos_total:   creditos + extra,
      // Vence al final del día elegido, no a la medianoche en que empieza.
      vence_en:         form.vence ? new Date(`${form.vence}T23:59:59`).toISOString() : null,
      notas:            notas || null,
      origen:           form.tipo,
      // Sin `codigo` en la fila, la base pone uno aleatorio.
      ...(codigo ? { codigo } : {}),
    };

    setGuardando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('digitalizacion_creditos')
      .insert(fila)
      .select()
      .single();
    setGuardando(false);
    if (err) {
      setError(
        err.code === '23505'
          ? `Ya existe un código "${codigo}". Elegí otro.`
          : /origen/.test(err.message)
            ? 'Falta correr el script 13 en Supabase para poder distinguir códigos manuales y demos.'
            : err.message);
      return;
    }

    registrarAuditoria({
      tabla: 'digitalizacion_creditos', registroId: data.id, accion: 'crear',
      descripcion: `Código ${esDemo ? 'demo' : 'manual'} ${data.codigo} con ${data.creditos_total} usos para "${data.cliente_nombre}"`,
      datosNuevos: data,
    });
    onCreado(data);
  }

  const usos = Math.trunc(Number(form.creditos)) || 0;

  return (
    <form onSubmit={guardar} className="border border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-headline font-bold">Nuevo código</p>
        <div className="flex rounded-xl border border-outline-variant/30 overflow-hidden text-xs font-bold">
          {[['manual', 'person', 'Para un cliente'], ['demo', 'science', 'Demo']].map(([k, icon, label]) => (
            <button key={k} type="button" onClick={() => elegirTipo(k)}
              className={`flex items-center gap-1 px-3 py-1.5 transition-all ${form.tipo === k ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
              <span className="material-symbols-outlined text-sm">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
      {esDemo && (
        <p className="text-xs text-on-surface-variant -mt-1">
          Para mostrar el software: pocos usos y vencimiento corto. Queda marcado como Demo y no se mezcla con las ventas.
        </p>
      )}
      <div>
        <input value={form.codigo} onChange={e => set('codigo', normalizarCodigo(e.target.value))}
          placeholder={esDemo ? 'Código (opcional, ej: DEMO-FERIA) · vacío = aleatorio' : 'Código (opcional) · vacío = aleatorio MTX-XXXX-XXXX'}
          autoComplete="off" spellCheck={false}
          className="input-field text-sm py-2 font-mono uppercase tracking-wider" />
        {form.codigo && (
          <p className="text-[11px] text-on-surface-variant mt-1">
            Un código fácil de adivinar lo puede usar cualquiera que lo pruebe: para demos está bien,
            pero dale pocos usos y vencimiento.
          </p>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={form.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)}
          placeholder={esDemo ? 'Para quién o para qué * (ej: Feria textil)' : 'Nombre del cliente *'}
          className="input-field text-sm py-2" />
        <input value={form.cliente_whatsapp} onChange={e => set('cliente_whatsapp', e.target.value)}
          placeholder="WhatsApp (5491112345678)" className="input-field text-sm py-2 font-mono" />
        <input type="email" value={form.cliente_email} onChange={e => set('cliente_email', e.target.value)}
          placeholder="Email (opcional)" className="input-field text-sm py-2" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Usos
            <input type="number" min="1" step="1" value={form.creditos} onChange={e => set('creditos', e.target.value)}
              className="input-field text-sm py-2 mt-1" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Vence {esDemo ? '' : '(opcional)'}
            <input type="date" value={form.vence} onChange={e => set('vence', e.target.value)}
              className="input-field text-sm py-2 mt-1" />
          </label>
        </div>
      </div>
      <input value={form.notas} onChange={e => set('notas', e.target.value)}
        placeholder={esDemo ? 'Notas (ej: demo para el taller de Flores)' : 'Notas (ej: cortesía por el taller de octubre)'}
        className="input-field text-sm py-2" />
      {!esDemo && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={form.porAlias} onChange={e => set('porAlias', e.target.checked)}
            className="w-4 h-4 accent-primary" />
          <span>
            Pagó por alias y mandó el comprobante
            {extraAlias > 0 && <span className="text-secondary font-bold"> → +{extraAlias} de regalo</span>}
          </span>
        </label>
      )}
      {!esDemo && form.porAlias && extraAlias > 0 && (
        <p className="text-xs text-on-surface-variant -mt-1">
          El código sale con {usos + extraAlias} usos: los {usos} que pagó más {extraAlias} de regalo.
        </p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-variant">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="btn-primary text-sm py-2 disabled:opacity-50">
          {guardando ? 'Creando…' : esDemo ? 'Crear demo' : 'Crear código'}
        </button>
      </div>
    </form>
  );
}

// ── La pestaña ──────────────────────────────────────────────────

function TabCreditos() {
  const [creditos,  setCreditos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [vista,     setVista]     = useState('codigos');   // codigos | historial
  const [filtro,    setFiltro]    = useState('activo');
  const [origen,    setOrigen]    = useState('todos');
  const [busqueda,  setBusqueda]  = useState('');
  const [copiado,   setCopiado]   = useState(null);
  const [guardando, setGuardando] = useState(null);
  const [creando,   setCreando]   = useState(false);
  // Historial desplegado: id del código + una versión que sube con cada
  // cambio, para que se recargue y muestre el movimiento recién hecho.
  const [abierto,   setAbierto]   = useState(null);
  const [version,   setVersion]   = useState(0);

  useEffect(() => {
    let vivo = true;
    traerCreditos().then(filas => {
      if (!vivo) return;
      setCreditos(filas);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, []);

  function reemplazar(data) {
    setCreditos(prev => prev.map(x => x.id === data.id ? data : x));
    setVersion(v => v + 1);
  }

  // El estado (activo / agotado) lo recalcula un trigger, y el movimiento lo
  // anota otro: acá solo se mueve el contador y se relee la fila.
  async function cambiarUsados(c, delta) {
    const nuevos = Math.min(c.creditos_total, Math.max(0, c.creditos_usados + delta));
    if (nuevos === c.creditos_usados) return;
    setGuardando(c.id);
    const { data, error } = await supabase
      .from('digitalizacion_creditos')
      .update({ creditos_usados: nuevos })
      .eq('id', c.id)
      .select()
      .single();
    setGuardando(null);
    if (error) { alert(error.message); return; }
    reemplazar(data);
  }

  // Sube o baja el límite de usos de un código: regalarle 5 más a un cliente,
  // o corregir uno que se cargó de más. No puede quedar por debajo de lo que
  // ya se usó (la base lo rechaza con un check).
  async function cambiarLimite(c) {
    const resp = prompt(
      `Límite de usos de ${c.codigo}\n(ya usó ${c.creditos_usados}; el nuevo límite no puede ser menor)`,
      String(c.creditos_total)
    );
    if (resp === null) return;
    const total = Math.trunc(Number(resp));
    if (!Number.isFinite(total) || total < 1) { alert('Tiene que ser un número de 1 en adelante.'); return; }
    if (total < c.creditos_usados) { alert(`Ya usó ${c.creditos_usados}: el límite no puede ser menor.`); return; }
    if (total === c.creditos_total) return;

    setGuardando(c.id);
    const { data, error } = await supabase
      .from('digitalizacion_creditos')
      .update({ creditos_total: total })
      .eq('id', c.id)
      .select()
      .single();
    setGuardando(null);
    if (error) { alert(error.message); return; }
    registrarAuditoria({
      tabla: 'digitalizacion_creditos', registroId: c.id, accion: 'editar',
      descripcion: `Límite de ${c.codigo}: ${c.creditos_total} → ${total}`,
      datosAnteriores: { creditos_total: c.creditos_total }, datosNuevos: { creditos_total: total },
    });
    reemplazar(data);
  }

  async function anular(c) {
    const anulando = c.estado !== 'anulado';
    if (anulando && !confirm(`¿Anular el código ${c.codigo}? Deja de servir para digitalizar.`)) return;
    setGuardando(c.id);
    const { data, error } = await supabase
      .from('digitalizacion_creditos')
      .update({ estado: anulando ? 'anulado' : 'activo' })
      .eq('id', c.id)
      .select()
      .single();
    setGuardando(null);
    if (error) { alert(error.message); return; }
    reemplazar(data);
  }

  async function copiar(codigo) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      alert(codigo);
    }
  }

  function linkWhatsapp(c) {
    const num = (c.cliente_whatsapp || '').replace(/\D/g, '');
    if (!num) return null;
    const restantes = c.creditos_restantes;
    const texto = encodeURIComponent(
      `Hola ${c.cliente_nombre || ''}! Tu código de digitalización es *${c.codigo}*. ` +
      `Te quedan ${restantes} ${restantes === 1 ? 'digitalización' : 'digitalizaciones'}.\n\n` +
      `Consultalo y entrá al software desde acá:\n${window.location.origin}/software`
    );
    return `https://wa.me/${num}?text=${texto}`;
  }

  const FILTROS = [
    { key: 'activo',  label: 'Activos' },
    { key: 'agotado', label: 'Agotados' },
    { key: 'anulado', label: 'Anulados' },
    { key: 'todos',   label: 'Todos' },
  ];

  const delOrigen = creditos.filter(c => origen === 'todos' || origenDe(c) === origen);
  const conteo = key => key === 'todos' ? delOrigen.length : delOrigen.filter(c => c.estado === key).length;

  const visibles = delOrigen.filter(c => {
    if (filtro !== 'todos' && c.estado !== filtro) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return [c.codigo, c.cliente_nombre, c.cliente_whatsapp, c.cliente_email, c.notas]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex rounded-xl border border-outline-variant/30 overflow-hidden text-xs font-bold">
          {[['codigos', 'key', 'Códigos'], ['historial', 'history', 'Historial']].map(([k, icon, label]) => (
            <button key={k} onClick={() => setVista(k)}
              className={`flex items-center gap-1 px-3 py-2 transition-all ${vista === k ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
              <span className="material-symbols-outlined text-base">{icon}</span>{label}
            </button>
          ))}
        </div>
        {vista === 'codigos' && !creando && (
          <button onClick={() => setCreando(true)}
            className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-base">add</span>Nuevo código o demo
          </button>
        )}
      </div>

      {vista === 'historial' ? <HistorialGeneral /> : (
        <>
          <ResumenCreditos creditos={creditos} />

          {creando && (
            <FormNuevoCodigo
              onCancelar={() => setCreando(false)}
              onCreado={nuevo => {
                setCreditos(prev => [nuevo, ...prev]);
                setCreando(false);
                setFiltro('activo');
                setOrigen('todos');
                setBusqueda(nuevo.codigo);
              }}
            />
          )}

          <div className="flex gap-2 flex-wrap">
            {[['todos', 'Todo origen'], ...Object.entries(ORIGENES_CODIGO).map(([k, o]) => [k, o.label])].map(([k, label]) => (
              <button key={k} onClick={() => setOrigen(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
                  origen === k ? 'bg-secondary/15 border-secondary/40 text-secondary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
                }`}>
                {label}
              </button>
            ))}
            <span className="w-px bg-outline-variant/30 mx-1" />
            {FILTROS.map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
                  filtro === f.key ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
                }`}>
                {f.label} ({conteo(f.key)})
              </button>
            ))}
          </div>

          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre, WhatsApp, email o notas"
            className="input-field text-sm py-2"
          />

          <div className="space-y-2">
            {visibles.map(c => {
              const wa = linkWhatsapp(c);
              const conHistorial = abierto === c.id;
              return (
                <div key={c.id} className="border border-outline-variant/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <button onClick={() => copiar(c.codigo)} title="Copiar código"
                        className="font-mono font-black text-lg text-primary hover:underline flex items-center gap-2">
                        {c.codigo}
                        <span className="material-symbols-outlined text-base text-on-surface-variant">
                          {copiado === c.codigo ? 'check' : 'content_copy'}
                        </span>
                      </button>
                      <p className="text-sm font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                        {c.cliente_nombre || 'Sin nombre'} <ChipOrigen origen={origenDe(c)} />
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {c.cliente_whatsapp || '—'}{c.cliente_email ? ` · ${c.cliente_email}` : ''}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Creado: {fmtDate(c.creado_en)}{c.creado_por_email ? ` · por ${c.creado_por_email}` : ''}
                      </p>
                      {c.vence_en && (
                        <p className={`text-xs ${estaVencido(c) ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                          {estaVencido(c) ? 'Venció' : 'Vence'}: {fmtDate(c.vence_en)}
                        </p>
                      )}
                      {c.notas && <p className="text-xs text-on-surface-variant italic mt-0.5">{c.notas}</p>}
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${
                        c.estado === 'activo'  ? 'bg-secondary/15 text-secondary' :
                        c.estado === 'agotado' ? 'bg-surface-variant text-on-surface-variant' :
                        'bg-error/10 text-error'
                      }`}>{c.estado}</span>
                      <p className="font-headline font-black text-xl mt-1">
                        {c.creditos_restantes}<span className="text-sm text-on-surface-variant"> / {c.creditos_total}</span>
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                        Quedan · {c.creditos_usados} gastados
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap pt-1 border-t border-outline-variant/10">
                    <button onClick={() => cambiarUsados(c, 1)} disabled={guardando === c.id || c.creditos_restantes === 0}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all disabled:opacity-40">
                      <span className="material-symbols-outlined text-base">remove_circle</span>Usar 1
                    </button>
                    <button onClick={() => cambiarUsados(c, -1)} disabled={guardando === c.id || c.creditos_usados === 0}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-bold hover:bg-surface-variant/70 transition-all disabled:opacity-40">
                      <span className="material-symbols-outlined text-base">undo</span>Devolver 1
                    </button>
                    <button onClick={() => cambiarLimite(c)} disabled={guardando === c.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-bold hover:bg-surface-variant/70 transition-all disabled:opacity-40">
                      <span className="material-symbols-outlined text-base">tune</span>Cambiar límite
                    </button>
                    <button onClick={() => setAbierto(conHistorial ? null : c.id)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${conHistorial ? 'bg-primary/15 text-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-variant/70'}`}>
                      <span className="material-symbols-outlined text-base">history</span>Historial
                    </button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#25D366]/10 text-[#1EBE5A] text-xs font-bold hover:bg-[#25D366]/20 transition-all">
                        <span className="material-symbols-outlined text-base">chat</span>Reenviar por WhatsApp
                      </a>
                    )}
                    <button onClick={() => anular(c)} disabled={guardando === c.id}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-error/10 text-error text-xs font-bold hover:bg-error/20 transition-all disabled:opacity-40 ml-auto">
                      <span className="material-symbols-outlined text-base">{c.estado === 'anulado' ? 'restart_alt' : 'block'}</span>
                      {c.estado === 'anulado' ? 'Reactivar' : 'Anular'}
                    </button>
                  </div>

                  {conHistorial && <HistorialCodigo key={`${c.id}-${version}`} creditoId={c.id} />}
                </div>
              );
            })}

            {visibles.length === 0 && (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">key</span>
                <p className="text-on-surface-variant">Sin códigos en esta categoría</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB DIGITALIZACIONES
//
// La galería de la cola que crea el script 09. Acá no se procesa nada:
// se ve qué mandó cada cliente, en qué estado está y se bajan los
// archivos que dejó el procesador. El crédito NO se descuenta desde acá:
// lo hace un trigger de la base cuando la fila pasa a 'procesado'.
// ════════════════════════════════════════════════════════════════

const DIG_BUCKET     = 'digitalizaciones';
const FIRMA_SEGUNDOS = 60 * 60 * 24;     // 24 hs, igual que en moldes

const ESTADOS_DIG = {
  pendiente:  { label: 'Pendiente',  icon: 'hourglass_top', clase: 'bg-tertiary/15 text-tertiary'   },
  procesando: { label: 'Procesando', icon: 'autorenew',     clase: 'bg-primary/15 text-primary'     },
  procesado:  { label: 'Procesado',  icon: 'check_circle',  clase: 'bg-secondary/15 text-secondary' },
  error:      { label: 'Error',      icon: 'warning',       clase: 'bg-error/10 text-error'         },
};

// El bucket es privado: todo lo que se muestra o se baja pasa por acá.
async function firmarArchivo(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(DIG_BUCKET)
    .createSignedUrl(path, FIRMA_SEGUNDOS);
  if (error) {
    alert(`No se pudo generar el link de descarga: ${error.message}`);
    return null;
  }
  return data?.signedUrl || null;
}

async function abrirArchivo(path) {
  const url = await firmarArchivo(path);
  if (url) window.open(url, '_blank', 'noopener');
}

// Una sola llamada para firmar todas las fotos en vez de una por tarjeta.
// Devuelve { digitalizacion_id → signed URL }.
async function firmarMiniaturas(datos) {
  const paths = datos.map(d => d.imagen_original_path).filter(Boolean);
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(DIG_BUCKET).createSignedUrls(paths, FIRMA_SEGUNDOS);
  if (!data) return {};
  const porPath = Object.fromEntries(data.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
  return Object.fromEntries(
    datos.filter(d => porPath[d.imagen_original_path]).map(d => [d.id, porPath[d.imagen_original_path]])
  );
}

async function traerDigitalizaciones() {
  const { data, error } = await supabase
    .from('digitalizaciones')
    .select('*, credito:digitalizacion_creditos(codigo, estado, creditos_total, creditos_restantes)')
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Formulario para cargar una digitalización a mano.
//
// Existe por dos motivos: probar el circuito completo antes de que la app
// del procesador esté hecha, y poder cargarle vos la foto al cliente que
// la manda por WhatsApp en vez de usar la app.
function FormCargarDigitalizacion({ onCargada, onCancelar }) {
  const [codigos,  setCodigos]  = useState([]);
  const [creditoId, setCreditoId] = useState('');
  const [archivo,  setArchivo]  = useState(null);
  const [notas,    setNotas]    = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase
      .from('digitalizacion_creditos')
      .select('*')
      .eq('estado', 'activo')
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return;
        const conSaldo = (data || []).filter(c => c.creditos_restantes > 0);
        setCodigos(conSaldo);
        if (conSaldo.length === 1) setCreditoId(conSaldo[0].id);
      });
    return () => { vivo = false; };
  }, []);

  async function guardar() {
    const credito = codigos.find(c => c.id === creditoId);
    if (!credito) { alert('Elegí el código del cliente.'); return; }
    if (!archivo)  { alert('Elegí la foto del molde.');     return; }

    setSubiendo(true);
    // El id se genera acá para poder armar la carpeta ANTES de insertar la
    // fila: así el path guardado y el archivo subido no pueden diferir.
    const id   = crypto.randomUUID();
    const ext  = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${credito.codigo}/${id}/original.${ext}`;

    // La foto se sube SIN comprimir: el procesador mide sobre esos píxeles
    // (marcadores, escala) y recomprimirla le saca precisión.
    const { error: errSubida } = await supabase.storage
      .from(DIG_BUCKET)
      .upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: true });

    if (errSubida) {
      setSubiendo(false);
      alert(`No se pudo subir la foto: ${errSubida.message}`);
      return;
    }

    const { data, error } = await supabase
      .from('digitalizaciones')
      .insert({
        id,
        credito_id:           credito.id,
        codigo:               credito.codigo,
        cliente_nombre:       credito.cliente_nombre,
        cliente_whatsapp:     credito.cliente_whatsapp,
        cliente_email:        credito.cliente_email,
        imagen_original_path: path,
        notas:                notas.trim() || null,
      })
      .select('*, credito:digitalizacion_creditos(codigo, estado, creditos_total, creditos_restantes)')
      .single();

    setSubiendo(false);

    if (error) {
      // Sin fila, el archivo queda huérfano en el bucket: se borra.
      await supabase.storage.from(DIG_BUCKET).remove([path]);
      alert(error.message);
      return;
    }
    onCargada(data);
  }

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-3">
      <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-primary">
        Cargar una digitalización
      </h3>

      {codigos.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No hay códigos activos con créditos disponibles. Los códigos se emiten solos al aprobar
          una venta con plan de digitalización (pestaña Créditos).
        </p>
      ) : (
        <>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Código del cliente</label>
            <select value={creditoId} onChange={e => setCreditoId(e.target.value)} className="input-field text-sm py-2">
              <option value="">Elegí un código…</option>
              {codigos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.cliente_nombre || 'Sin nombre'} ({c.creditos_restantes} de {c.creditos_total})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Foto del molde</label>
            <input type="file" accept="image/*" onChange={e => setArchivo(e.target.files?.[0] || null)}
              className="text-sm w-full file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-bold" />
            <p className="text-[11px] text-on-surface-variant mt-1">
              Se guarda tal cual, sin comprimir. Máximo 20 MB.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Notas (opcional)</label>
            <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Lo que haya que saber del trabajo" className="input-field text-sm py-2" />
          </div>

          <div className="flex gap-2">
            <button onClick={guardar} disabled={subiendo}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40">
              <span className={`material-symbols-outlined text-base ${subiendo ? 'animate-spin' : ''}`}>
                {subiendo ? 'refresh' : 'upload'}
              </span>
              {subiendo ? 'Subiendo…' : 'Cargar'}
            </button>
            <button onClick={onCancelar} disabled={subiendo}
              className="px-4 py-2 rounded-xl bg-surface-variant text-on-surface-variant text-xs font-bold hover:bg-surface-variant/70 transition-all disabled:opacity-40">
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TabDigitalizaciones() {
  const [filas,     setFilas]     = useState([]);
  const [miniaturas, setMiniaturas] = useState({});   // id → signed URL
  const [loading,   setLoading]   = useState(true);
  const [faltaTabla, setFaltaTabla] = useState(false);
  const [filtro,    setFiltro]    = useState('todas');
  const [busqueda,  setBusqueda]  = useState('');
  const [guardando, setGuardando] = useState(null);
  const [cargando,  setCargando]  = useState(false);

  useEffect(() => {
    let vivo = true;
    traerDigitalizaciones()
      .then(datos => {
        if (!vivo) return;
        setFilas(datos);
        setLoading(false);
        firmarMiniaturas(datos).then(m => { if (vivo) setMiniaturas(m); });
      })
      .catch(e => {
        if (!vivo) return;
        // La pantalla se abre igual y dice qué falta, en vez de quedarse
        // girando para siempre.
        console.error('[digitalizaciones]', e.message);
        setFaltaTabla(true);
        setLoading(false);
      });
    return () => { vivo = false; };
  }, []);

  // El crédito lo mueve el trigger, así que después de cambiar el estado se
  // relee TODA la lista: los contadores de los otros trabajos del mismo
  // código también cambiaron.
  async function cambiarEstado(fila, estado) {
    if (estado === fila.estado_procesamiento) return;
    setGuardando(fila.id);
    const cambios = { estado_procesamiento: estado };
    if (estado === 'error' && !fila.error_mensaje) {
      cambios.error_mensaje = prompt('¿Qué falló? (opcional)') || null;
    }
    const { error } = await supabase.from('digitalizaciones').update(cambios).eq('id', fila.id);
    if (error) { setGuardando(null); alert(error.message); return; }

    const datos = await traerDigitalizaciones();
    setFilas(datos);
    setGuardando(null);
  }

  async function eliminar(fila) {
    if (!confirm(`¿Enviar la digitalización de ${fila.cliente_nombre || 'este cliente'} a la papelera?`)) return;
    setGuardando(fila.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('digitalizaciones').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', fila.id);
    setGuardando(null);
    if (error) { alert(error.message); return; }
    await registrarAuditoria({
      tabla: 'digitalizaciones', registroId: fila.id, accion: 'eliminacion',
      descripcion: `Digitalización de "${fila.cliente_nombre || 'sin nombre'}" (${fila.codigo || 'sin código'}) enviada a papelera`,
      datosAnteriores: fila,
    });
    setFilas(prev => prev.filter(x => x.id !== fila.id));
  }

  const FILTROS = [
    { key: 'todas',      label: 'Todas' },
    { key: 'pendiente',  label: 'Pendientes' },
    { key: 'procesando', label: 'Procesando' },
    { key: 'procesado',  label: 'Listas' },
    { key: 'error',      label: 'Con error' },
  ];

  const conteo = key => key === 'todas' ? filas.length : filas.filter(f => f.estado_procesamiento === key).length;

  const visibles = filas.filter(f => {
    if (filtro !== 'todas' && f.estado_procesamiento !== filtro) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return [f.codigo, f.cliente_nombre, f.cliente_whatsapp, f.cliente_email]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  if (faltaTabla) {
    return (
      <div className="border border-error/30 bg-error/5 rounded-2xl p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-error block mb-2">database</span>
        <p className="font-bold">Falta correr el script 09</p>
        <p className="text-sm text-on-surface-variant mt-1">
          La cola de digitalizaciones vive en la tabla <code>digitalizaciones</code>, que crea
          <code> sql/productos/09_digitalizaciones.sql</code>. Corrélo en el SQL Editor de Supabase
          y volvé a entrar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {FILTROS.map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border ${
              filtro === f.key ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'
            }`}>
            {f.label} ({conteo(f.key)})
          </button>
        ))}
        <button onClick={() => setCargando(v => !v)}
          className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-all">
          <span className="material-symbols-outlined text-base">{cargando ? 'close' : 'add_a_photo'}</span>
          {cargando ? 'Cerrar' : 'Cargar'}
        </button>
      </div>

      {cargando && (
        <FormCargarDigitalizacion
          onCancelar={() => setCargando(false)}
          onCargada={fila => {
            setFilas(prev => [fila, ...prev]);
            firmarMiniaturas([fila]).then(m => setMiniaturas(prev => ({ ...prev, ...m })));
            setCargando(false);
          }}
        />
      )}

      <input
        type="search"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por cliente, código, WhatsApp o email"
        className="input-field text-sm py-2"
      />

      <div className="space-y-2">
        {visibles.map(f => {
          const est   = ESTADOS_DIG[f.estado_procesamiento] || ESTADOS_DIG.pendiente;
          const cred  = f.credito;
          const thumb = miniaturas[f.id];
          return (
            <div key={f.id} className="border border-outline-variant/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-4 flex-wrap">
                <button onClick={() => abrirArchivo(f.imagen_original_path)} disabled={!f.imagen_original_path}
                  title="Ver la foto original"
                  className="w-24 h-24 rounded-xl overflow-hidden bg-surface-variant shrink-0 flex items-center justify-center disabled:cursor-default">
                  {thumb
                    ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                    : <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">image</span>}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{f.cliente_nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-on-surface-variant">
                    {f.cliente_whatsapp || '—'}{f.cliente_email ? ` · ${f.cliente_email}` : ''}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-mono font-bold text-primary">{f.codigo || 'sin código'}</span>
                    {cred && (
                      <span className="text-on-surface-variant">
                        {' · '}quedan {cred.creditos_restantes} de {cred.creditos_total}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {fmtDate(f.creado_en)}
                    {f.procesado_en ? ` · procesado ${fmtDate(f.procesado_en)}` : ''}
                  </p>
                  {f.notas && <p className="text-xs text-on-surface-variant mt-1 italic">{f.notas}</p>}
                  {f.estado_procesamiento === 'error' && f.error_mensaje && (
                    <p className="text-xs text-error mt-1">{f.error_mensaje}</p>
                  )}
                  {f.estado_procesamiento === 'procesado' && !f.credito_consumido && (
                    <p className="text-xs text-error mt-1">
                      Quedó procesada sin descontar crédito: el código no tenía saldo.
                    </p>
                  )}
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 shrink-0 ${est.clase}`}>
                  {est.label}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap items-center pt-1 border-t border-outline-variant/10">
                {f.archivo_pdf_path && (
                  <button onClick={() => abrirArchivo(f.archivo_pdf_path)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary/20 transition-all">
                    <span className="material-symbols-outlined text-base">picture_as_pdf</span>PDF
                  </button>
                )}
                {f.archivo_dxf_path && (
                  <button onClick={() => abrirArchivo(f.archivo_dxf_path)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary/20 transition-all">
                    <span className="material-symbols-outlined text-base">download</span>DXF
                  </button>
                )}
                {f.archivo_plt_path && (
                  <button onClick={() => abrirArchivo(f.archivo_plt_path)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary/20 transition-all">
                    <span className="material-symbols-outlined text-base">download</span>PLT
                  </button>
                )}

                <select value={f.estado_procesamiento} onChange={e => cambiarEstado(f, e.target.value)}
                  disabled={guardando === f.id}
                  className="input-field text-xs py-1.5 w-auto disabled:opacity-40">
                  {Object.entries(ESTADOS_DIG).map(([key, v]) => (
                    <option key={key} value={key}>{v.label}</option>
                  ))}
                </select>

                <button onClick={() => eliminar(f)} disabled={guardando === f.id}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-error/10 text-error text-xs font-bold hover:bg-error/20 transition-all disabled:opacity-40 ml-auto">
                  <span className="material-symbols-outlined text-base">delete</span>Eliminar
                </button>
              </div>
            </div>
          );
        })}

        {visibles.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">image_search</span>
            <p className="text-on-surface-variant">Sin digitalizaciones en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — el sector propio de la pizarra
//
// Los datos viven en `productos` junto con el resto del catálogo, pero
// esta pantalla es solo de pizarras: acá se enchufa la digitalización.
// ════════════════════════════════════════════════════════════════

export default function PizarrasAdminPage() {
  const [tab, setTab] = useState('productos');

  const TABS = [
    { key: 'productos', label: 'Productos', icon: 'draw' },
    { key: 'planes',    label: 'Planes',    icon: 'sell' },
    { key: 'ventas',    label: 'Ventas',    icon: 'shopping_bag' },
    { key: 'creditos',  label: 'Créditos',  icon: 'key' },
    { key: 'digitaliz', label: 'Digitalizaciones', icon: 'image_search' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline text-2xl font-bold">Pizarras digitalizadoras</h1>
        <p className="text-on-surface-variant text-sm mt-1">Administrá los planes, las ventas, los envíos y los códigos de digitalización</p>
      </div>

      <div className="flex gap-1 border-b border-outline-variant/20">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-all border-b-2 ${
              tab === t.key
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
            }`}>
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'productos' && <TabProductos />}
      {tab === 'planes'    && <TabPlanes />}
      {tab === 'ventas'    && <TabVentas />}
      {tab === 'creditos'  && <TabCreditos />}
      {tab === 'digitaliz' && <TabDigitalizaciones />}
    </div>
  );
}
