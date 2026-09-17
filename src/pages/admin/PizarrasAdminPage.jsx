import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../utils/imageCompression';
import { registrarAuditoria } from '../../utils/auditoria';
import { useAuth } from '../../context/AuthContext';

const SUPER_ADMIN  = 'ing.lp.tech@gmail.com';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const IMG_BUCKET   = 'pizarras-imagenes';

function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMG_BUCKET}/${path}`;
}

function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

async function uploadImagen(file, pizarraId, slot) {
  const blob = await compressImage(file);
  const path = `${pizarraId}/img_${slot}.jpg`;
  const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

// ── Selector de imagen (slot individual) ─────────────────────────────────────
function SlotImagen({ valor, onChange, label }) {
  const ref = useRef();
  const [preview, setPreview] = useState(valor ? imgUrl(valor) : null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { setPreview(valor ? imgUrl(valor) : null); }, [valor]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const blob = await compressImage(file);
      const url  = URL.createObjectURL(blob);
      setPreview(url);
      onChange(file, blob);
    } catch { alert('Error al procesar la imagen'); }
    finally { setCargando(false); }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        onClick={() => ref.current?.click()}
        className="w-24 h-24 rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-primary/50 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-surface-variant relative"
      >
        {cargando && <span className="material-symbols-outlined text-primary animate-spin text-2xl">refresh</span>}
        {!cargando && preview && <img src={preview} alt="" className="w-full h-full object-cover" />}
        {!cargando && !preview && <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">add_photo_alternate</span>}
        {!cargando && preview && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setPreview(null); onChange(null, null); }}
            className="absolute top-1 right-1 bg-error text-white rounded-full p-0.5"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        )}
      </div>
      <span className="text-[10px] text-on-surface-variant">{label}</span>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
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
      for (let i = 0; i < 3; i++) {
        if (imgBlobs[i]) paths[i] = await uploadImagen(imgs[i], pizarraId, i + 1);
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
          const portada = imgUrl(p.imagen_1_path);
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
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al aprobar'); return; }

      const wa_num = compra.whatsapp.replace(/\D/g, '');

      // El endpoint devuelve el código cuando el plan otorga créditos: ese
      // mensaje es la entrega del producto, así que va primero.
      const cred = data.credito;
      const texto = encodeURIComponent(
        cred
          ? `Hola ${compra.nombre}! ✅ Tu pago fue aprobado.\nTu código de digitalización es:\n\n*${cred.codigo}*\n\nTe sirve para ${cred.creditos} ${cred.creditos === 1 ? 'digitalización' : 'digitalizaciones'}.\n¡Gracias por tu compra en Moldi Tex! 🧵`
          : compra.metodo_envio === 'coordinar'
            ? `Hola ${compra.nombre}! ✅ Tu pago fue aprobado. Coordinemos por acá el envío de tu *${compra.titulo_producto}*. ¡Gracias por tu compra en Moldi Tex! 📦`
            : `Hola ${compra.nombre}! ✅ Tu pago fue aprobado. Ya estamos preparando el envío de tu *${compra.titulo_producto}* por ${compra.envia_carrier}. Te paso el código de seguimiento en cuanto lo generemos. ¡Gracias por tu compra en Moldi Tex! 📦`
      );
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
      const data = await res.json();
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
      } : c));
    } catch (ex) {
      alert(ex?.message || 'Error inesperado');
    } finally {
      setGenerando(null);
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
                  {c.envia_tracking_number ? (
                    <div className="flex items-center justify-between gap-2 text-sm bg-secondary/10 rounded-xl p-3">
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
                      <div className="flex gap-2 shrink-0">
                        {c.envia_tracking_url && (
                          <a href={c.envia_tracking_url} target="_blank" rel="noreferrer"
                            className="btn-secondary text-xs py-2 px-3">Ver seguimiento</a>
                        )}
                        {c.envia_label_url && (
                          <a href={c.envia_label_url} target="_blank" rel="noreferrer"
                            className="btn-secondary text-xs py-2 px-3">Ver etiqueta</a>
                        )}
                      </div>
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
  requiere_envio: true, otorga_creditos: false,
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
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary rounded-full px-2 py-0.5">Créditos</span>
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
// Los códigos que se emiten al aprobar una compra de "Solo Software".
// Hasta que exista la cola de digitalizaciones (Etapa 6), el consumo
// se marca a mano desde acá.
// ════════════════════════════════════════════════════════════════

async function traerCreditos() {
  const { data } = await supabase
    .from('digitalizacion_creditos')
    .select('*')
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });
  return data || [];
}

function TabCreditos() {
  const [creditos,  setCreditos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filtro,    setFiltro]    = useState('activo');
  const [busqueda,  setBusqueda]  = useState('');
  const [copiado,   setCopiado]   = useState(null);
  const [guardando, setGuardando] = useState(null);

  useEffect(() => {
    let vivo = true;
    traerCreditos().then(filas => {
      if (!vivo) return;
      setCreditos(filas);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, []);

  // El estado (activo / agotado) lo recalcula un trigger: acá solo se mueve el
  // contador de usados y se relee la fila para no mostrar datos viejos.
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
    setCreditos(prev => prev.map(x => x.id === c.id ? data : x));
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
    setCreditos(prev => prev.map(x => x.id === c.id ? data : x));
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
      `Te quedan ${restantes} ${restantes === 1 ? 'digitalización' : 'digitalizaciones'}.`
    );
    return `https://wa.me/${num}?text=${texto}`;
  }

  const FILTROS = [
    { key: 'activo',  label: 'Activos' },
    { key: 'agotado', label: 'Agotados' },
    { key: 'anulado', label: 'Anulados' },
    { key: 'todos',   label: 'Todos' },
  ];

  const conteo = key => key === 'todos' ? creditos.length : creditos.filter(c => c.estado === key).length;

  const visibles = creditos.filter(c => {
    if (filtro !== 'todos' && c.estado !== filtro) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return [c.codigo, c.cliente_nombre, c.cliente_whatsapp, c.cliente_email]
      .some(v => (v || '').toLowerCase().includes(q));
  });

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

      <input
        type="search"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por código, nombre, WhatsApp o email"
        className="input-field text-sm py-2"
      />

      <div className="space-y-2">
        {visibles.map(c => {
          const wa = linkWhatsapp(c);
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
                  <p className="text-sm font-bold mt-0.5">{c.cliente_nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.cliente_whatsapp || '—'}{c.cliente_email ? ` · ${c.cliente_email}` : ''}
                  </p>
                  <p className="text-xs text-on-surface-variant">Emitido: {fmtDate(c.creado_en)}</p>
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
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Restantes</p>
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
    </div>
  );
}
