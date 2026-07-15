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
    const { data } = await supabase.from('pizarras').select('*').is('eliminado_en', null).order('orden');
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
        ? await supabase.from('pizarras').update(payload).eq('id', editando.id)
        : await supabase.from('pizarras').insert({ id: pizarraId, ...payload });

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
    await supabase.from('pizarras').update({ activo: !p.activo }).eq('id', p.id);
    setPizarras(prev => prev.map(x => x.id === p.id ? { ...x, activo: !p.activo } : x));
  }

  async function eliminar(p) {
    if (!confirm(`¿Enviar "${p.titulo}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('pizarras').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', p.id);
    await registrarAuditoria({ tabla: 'pizarras', registroId: p.id, accion: 'eliminacion', descripcion: `Pizarra "${p.titulo}" enviada a papelera`, datosAnteriores: p });
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
      .from('pizarras_compras')
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
      const res = await fetch('/api/pizarra-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ compra_id: compra.id, accion: 'aprobar' }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al aprobar'); return; }

      const wa_num = compra.whatsapp.replace(/\D/g, '');
      const texto = encodeURIComponent(
        `Hola ${compra.nombre}! ✅ Tu pago fue aprobado. Ya estamos preparando el envío de tu *${compra.titulo_pizarra}* por ${compra.envia_carrier}. Te paso el código de seguimiento en cuanto lo generemos. ¡Gracias por tu compra en Moldi Tex! 📦`
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
    await supabase.from('pizarras_compras').update({
      estado: 'rechazado', rechazo_motivo: motivo || null,
    }).eq('id', compra.id);
    setCompras(prev => prev.map(c => c.id === compra.id ? { ...c, estado: 'rechazado' } : c));
    setRechazando(null);
  }

  async function generarEnvio(compra) {
    setGenerando(compra.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/pizarra-admin', {
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
    if (!confirm(`¿Enviar la venta de ${compra.nombre} (${compra.titulo_pizarra}) a la papelera?`)) return;
    setEliminando(compra.id);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      const { error } = await supabase.from('pizarras_compras').update({
        eliminado_en: new Date().toISOString(), eliminado_por: u?.id, eliminado_por_email: u?.email,
      }).eq('id', compra.id);
      if (error) { alert(error.message); return; }
      await registrarAuditoria({
        tabla: 'pizarras_compras', registroId: compra.id, accion: 'eliminacion',
        descripcion: `Venta de "${compra.nombre}" (${compra.titulo_pizarra}) enviada a papelera`,
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
                  <p className="text-on-surface-variant text-xs">
                    {c.direccion_calle} {c.direccion_numero}{c.direccion_piso_depto ? `, ${c.direccion_piso_depto}` : ''}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    {c.direccion_ciudad}, {c.direccion_provincia} (CP {c.direccion_codigo_postal})
                  </p>
                </div>
                <div>
                  <p className="font-bold truncate">{c.titulo_pizarra}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.metodo_pago === 'mercadopago' ? '💳 MercadoPago' : '🏦 Transferencia'}
                    · Envío: {c.envia_carrier} — {c.envia_service_descripcion || c.envia_service} (${fmt(c.monto_envio)})
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

              {c.estado === 'aprobado' && (
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
// PÁGINA PRINCIPAL — 2 tabs
// ════════════════════════════════════════════════════════════════

export default function PizarrasAdminPage() {
  const [tab, setTab] = useState('productos');

  const TABS = [
    { key: 'productos', label: 'Productos', icon: 'draw' },
    { key: 'ventas',    label: 'Ventas',    icon: 'shopping_bag' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-headline text-2xl font-bold">Pizarras digitalizadoras</h1>
        <p className="text-on-surface-variant text-sm mt-1">Administrá el catálogo, las ventas y los envíos con envia.com</p>
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
      {tab === 'ventas'    && <TabVentas />}
    </div>
  );
}
