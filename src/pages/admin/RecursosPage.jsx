import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { registrarAuditoria } from '../../utils/auditoria';

const TIPOS = [
  { value: 'video',  label: 'Video',     icon: 'play_circle',    placeholder: 'https://vimeo.com/... o drive.google.com/...' },
  { value: 'pdf',    label: 'PDF / Doc', icon: 'picture_as_pdf', placeholder: 'https://drive.google.com/file/d/...' },
  { value: 'imagen', label: 'Imagen',    icon: 'image',          placeholder: 'https://drive.google.com/file/d/...' },
  { value: 'link',   label: 'Link',      icon: 'link',           placeholder: 'https://...' },
];

const TIPO_COLORES = {
  video:  { bg: 'bg-primary/15',   text: 'text-primary' },
  pdf:    { bg: 'bg-secondary/15', text: 'text-secondary' },
  imagen: { bg: 'bg-tertiary/15',  text: 'text-tertiary' },
  link:   { bg: 'bg-tertiary/15',  text: 'text-tertiary' },
};

const FORM_INICIAL          = { titulo: '', descripcion: '', tipo: 'video', url: '', carpeta_id: '', orden: 0, activo: true };
const FORM_CARPETA_INICIAL  = { nombre: '', orden: 0 };

// ── Helpers URL ───────────────────────────────────────────────────────────────

function extractVimeoId(url) {
  const m = url?.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function extractDriveId(url) {
  const m = url?.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function detectarFuente(url) {
  if (!url) return null;
  if (/vimeo\.com/.test(url))        return 'vimeo';
  if (/drive\.google\.com/.test(url)) return 'drive';
  return 'otro';
}

async function fetchVimeoThumb(url) {
  try {
    const id = extractVimeoId(url);
    if (!id) return null;
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=640`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch { return null; }
}

function getDriveImageSrc(url) {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function RecursosPage() {
  const [recursos,         setRecursos]         = useState([]);
  const [carpetas,         setCarpetas]         = useState([]);
  const [carpetasAbiertas, setCarpetasAbiertas] = useState(new Set());
  const [loading,          setLoading]          = useState(true);
  const [thumbnails,       setThumbnails]       = useState({});

  // Modal recurso
  const [showModal,  setShowModal]  = useState(false);
  const [editando,   setEditando]   = useState(null);
  const [form,       setForm]       = useState(FORM_INICIAL);
  const [guardando,  setGuardando]  = useState(false);
  const [error,      setError]      = useState('');

  // Modal carpeta
  const [showModalCarpeta,  setShowModalCarpeta]  = useState(false);
  const [editandoCarpeta,   setEditandoCarpeta]   = useState(null);
  const [formCarpeta,       setFormCarpeta]       = useState(FORM_CARPETA_INICIAL);
  const [guardandoCarpeta,  setGuardandoCarpeta]  = useState(false);
  const [errorCarpeta,      setErrorCarpeta]      = useState('');

  useEffect(() => { cargar(); }, []);

  // Thumbnails: Vimeo automático, Drive imagen directa
  useEffect(() => {
    recursos.forEach(async r => {
      if (thumbnails[r.id]) return;
      if (r.tipo === 'video' && detectarFuente(r.url) === 'vimeo') {
        const thumb = await fetchVimeoThumb(r.url);
        if (thumb) setThumbnails(prev => ({ ...prev, [r.id]: thumb }));
      }
      if (r.tipo === 'imagen') {
        const src = detectarFuente(r.url) === 'drive' ? getDriveImageSrc(r.url) : r.url;
        if (src) setThumbnails(prev => ({ ...prev, [r.id]: src }));
      }
    });
  }, [recursos]);

  async function cargar() {
    setLoading(true);
    try {
      const [{ data: res, error: e1 }, { data: caps, error: e2 }] = await Promise.all([
        supabase.from('recursos').select('*').is('eliminado_en', null).order('orden', { ascending: true }),
        supabase.from('carpetas').select('*').order('orden', { ascending: true }),
      ]);
      if (e1) throw e1;
      setRecursos(res || []);
      setCarpetas(caps || []);
      if (caps?.length > 0) setCarpetasAbiertas(new Set([caps[0].id]));
    } catch (e) {
      console.error('[Recursos] Error al cargar:', e.message);
    } finally {
      setLoading(false);
    }
  }

  // Agrupar recursos por carpeta_id
  const grupos = {};
  const sinCarpeta = [];
  recursos.forEach(r => {
    if (r.carpeta_id) {
      grupos[r.carpeta_id] = grupos[r.carpeta_id] || [];
      grupos[r.carpeta_id].push(r);
    } else {
      sinCarpeta.push(r);
    }
  });

  function toggleCarpeta(id) {
    setCarpetasAbiertas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── CRUD Recurso ────────────────────────────────────────────────────────────

  function abrirNuevo(carpetaId = null) {
    setEditando(null);
    setForm({ ...FORM_INICIAL, carpeta_id: carpetaId || '' });
    setError('');
    setShowModal(true);
  }

  function abrirEditar(r) {
    setEditando(r.id);
    setForm({
      titulo:      r.titulo,
      descripcion: r.descripcion || '',
      tipo:        r.tipo,
      url:         r.url,
      carpeta_id:  r.carpeta_id || '',
      orden:       r.orden,
      activo:      r.activo,
    });
    setError('');
    setShowModal(true);
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.url.trim()) {
      setError('El título y la URL son obligatorios');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const payload = {
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo:        form.tipo,
        url:         form.url.trim(),
        carpeta_id:  form.carpeta_id || null,
        orden:       Number(form.orden) || 0,
        activo:      form.activo,
      };
      const { error: err } = editando
        ? await supabase.from('recursos').update(payload).eq('id', editando)
        : await supabase.from('recursos').insert(payload);
      if (err) { setError(`Error al guardar: ${err.message}`); return; }
      setShowModal(false);
      await cargar();
    } catch (ex) {
      setError(ex?.message || 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(r) {
    await supabase.from('recursos').update({ activo: !r.activo }).eq('id', r.id);
    setRecursos(prev => prev.map(x => x.id === r.id ? { ...x, activo: !r.activo } : x));
  }

  async function eliminar(id) {
    if (!confirm('¿Enviar este recurso a la papelera?')) return;
    const recurso = recursos.find(r => r.id === id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('recursos').update({
      eliminado_en:        new Date().toISOString(),
      eliminado_por:       user?.id,
      eliminado_por_email: user?.email,
    }).eq('id', id);
    await registrarAuditoria({
      tabla:           'recursos',
      registroId:      id,
      accion:          'eliminacion',
      descripcion:     `Recurso "${recurso?.titulo}" enviado a papelera`,
      datosAnteriores: recurso || null,
    });
    setRecursos(prev => prev.filter(r => r.id !== id));
  }

  // ── CRUD Carpeta ─────────────────────────────────────────────────────────────

  function abrirNuevaCarpeta() {
    setEditandoCarpeta(null);
    setFormCarpeta({ nombre: '', orden: carpetas.length });
    setErrorCarpeta('');
    setShowModalCarpeta(true);
  }

  function abrirEditarCarpeta(c) {
    setEditandoCarpeta(c.id);
    setFormCarpeta({ nombre: c.nombre, orden: c.orden });
    setErrorCarpeta('');
    setShowModalCarpeta(true);
  }

  async function handleGuardarCarpeta(e) {
    e.preventDefault();
    if (!formCarpeta.nombre.trim()) { setErrorCarpeta('El nombre es obligatorio'); return; }
    setGuardandoCarpeta(true);
    setErrorCarpeta('');
    try {
      const payload = { nombre: formCarpeta.nombre.trim(), orden: Number(formCarpeta.orden) || 0 };
      const { error: err } = editandoCarpeta
        ? await supabase.from('carpetas').update(payload).eq('id', editandoCarpeta)
        : await supabase.from('carpetas').insert(payload);
      if (err) { setErrorCarpeta(`Error: ${err.message}`); return; }
      setShowModalCarpeta(false);
      await cargar();
    } catch (ex) {
      setErrorCarpeta(ex?.message || 'Error inesperado');
    } finally {
      setGuardandoCarpeta(false);
    }
  }

  async function eliminarCarpeta(c) {
    const count = (grupos[c.id] || []).length;
    const msg = count > 0
      ? `¿Eliminar carpeta "${c.nombre}"? Los ${count} recursos quedarán sin carpeta asignada.`
      : `¿Eliminar la carpeta "${c.nombre}"?`;
    if (!confirm(msg)) return;
    await supabase.from('carpetas').delete().eq('id', c.id);
    await cargar();
  }

  // ── Helpers render ───────────────────────────────────────────────────────────

  const tipoConf = t => TIPOS.find(x => x.value === t) || TIPOS[3];

  const activos = recursos.filter(r => r.activo).length;

  // Fila de recurso (inline para evitar re-montaje)
  function renderRecurso(r) {
    const tc = tipoConf(r.tipo);
    const col = TIPO_COLORES[r.tipo] || TIPO_COLORES.link;
    const fuente = detectarFuente(r.url);

    return (
      <div key={r.id} className={`flex items-center gap-3 px-4 py-3 transition-all ${!r.activo ? 'opacity-50' : ''}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${col.bg}`}>
          <span className={`material-symbols-outlined text-lg ${col.text}`}>{tc.icon}</span>
        </div>

        {/* Thumbnail imagen/video */}
        {(r.tipo === 'imagen' || (r.tipo === 'video' && thumbnails[r.id])) && thumbnails[r.id] && (
          <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0 hidden sm:block">
            <img src={thumbnails[r.id]} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{r.titulo}</p>
            {fuente === 'drive' && (
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 bg-surface-variant px-1.5 py-0.5 rounded-full shrink-0">
                Drive
              </span>
            )}
            {!r.activo && (
              <span className="text-[10px] font-black uppercase tracking-widest text-error/70 bg-error/10 px-1.5 py-0.5 rounded-full shrink-0">
                Oculto
              </span>
            )}
          </div>
          {r.descripcion && (
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{r.descripcion}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => toggleActivo(r)}
            title={r.activo ? 'Ocultar a alumnos' : 'Mostrar a alumnos'}
            className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base">{r.activo ? 'visibility' : 'visibility_off'}</span>
          </button>
          <button
            onClick={() => abrirEditar(r)}
            className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={() => eliminar(r.id)}
            className="p-1.5 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-bold">Recursos del Curso</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {recursos.length} recursos · {activos} activos — visibles para alumnos activos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={abrirNuevaCarpeta} className="btn-secondary flex items-center gap-2 text-sm">
            <span className="material-symbols-outlined text-sm">create_new_folder</span>
            <span className="hidden sm:inline">Nueva carpeta</span>
            <span className="sm:hidden">Carpeta</span>
          </button>
          <button onClick={() => abrirNuevo()} className="btn-primary flex items-center gap-2 text-sm">
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">Agregar recurso</span>
            <span className="sm:hidden">Recurso</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Videos',   icon: 'play_circle',    count: recursos.filter(r => r.tipo === 'video').length,  color: 'text-primary' },
          { label: 'PDFs',     icon: 'picture_as_pdf', count: recursos.filter(r => r.tipo === 'pdf').length,    color: 'text-secondary' },
          { label: 'Imágenes', icon: 'image',          count: recursos.filter(r => r.tipo === 'imagen').length, color: 'text-tertiary' },
          { label: 'Links',    icon: 'link',           count: recursos.filter(r => r.tipo === 'link').length,   color: 'text-tertiary' },
        ].map(s => (
          <div key={s.label} className="card border border-outline-variant/20 flex items-center gap-2 py-3 px-3">
            <span className={`material-symbols-outlined text-xl shrink-0 ${s.color}`}>{s.icon}</span>
            <div className="min-w-0">
              <p className="font-headline font-bold text-lg leading-none">{s.count}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Carpetas */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl">refresh</span>
        </div>
      ) : (
        <div className="space-y-3">

          {carpetas.map(c => {
            const items = grupos[c.id] || [];
            const abierta = carpetasAbiertas.has(c.id);
            return (
              <div key={c.id} className="border border-outline-variant/20 rounded-2xl overflow-hidden">

                {/* Cabecera de carpeta */}
                <div className="flex items-center bg-surface-container">
                  <button
                    onClick={() => toggleCarpeta(c.id)}
                    className="flex items-center gap-3 flex-1 p-4 hover:bg-surface-container-high transition-colors text-left min-w-0"
                  >
                    <span className="material-symbols-outlined text-primary text-2xl">
                      {abierta ? 'folder_open' : 'folder'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{c.nombre}</p>
                      <p className="text-xs text-on-surface-variant">
                        {items.length} {items.length === 1 ? 'recurso' : 'recursos'}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant shrink-0">
                      {abierta ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {/* Acciones de carpeta */}
                  <div className="flex items-center gap-0.5 pr-3 shrink-0">
                    <button
                      onClick={() => { abrirNuevo(c.id); if (!abierta) toggleCarpeta(c.id); }}
                      title="Agregar recurso en esta carpeta"
                      className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                    </button>
                    <button
                      onClick={() => abrirEditarCarpeta(c)}
                      className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => eliminarCarpeta(c)}
                      className="p-2 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>

                {/* Recursos dentro */}
                {abierta && (
                  <div className="border-t border-outline-variant/20 divide-y divide-outline-variant/10">
                    {items.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm text-on-surface-variant">Carpeta vacía</p>
                        <button
                          onClick={() => abrirNuevo(c.id)}
                          className="mt-2 text-primary text-sm font-medium hover:underline"
                        >
                          + Agregar recurso
                        </button>
                      </div>
                    ) : (
                      items.map(r => renderRecurso(r))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sin carpeta */}
          {sinCarpeta.length > 0 && (
            <div className="border border-dashed border-outline-variant/30 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleCarpeta('__sin__')}
                className="w-full flex items-center gap-3 p-4 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
              >
                <span className="material-symbols-outlined text-on-surface-variant/50 text-2xl">folder_off</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface-variant/70">Sin carpeta</p>
                  <p className="text-xs text-on-surface-variant/50">
                    {sinCarpeta.length} {sinCarpeta.length === 1 ? 'recurso' : 'recursos'} sin asignar
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant/50 shrink-0">
                  {carpetasAbiertas.has('__sin__') ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {carpetasAbiertas.has('__sin__') && (
                <div className="border-t border-outline-variant/20 divide-y divide-outline-variant/10">
                  {sinCarpeta.map(r => renderRecurso(r))}
                </div>
              )}
            </div>
          )}

          {/* Estado vacío total */}
          {carpetas.length === 0 && sinCarpeta.length === 0 && (
            <div className="card border border-outline-variant/20 text-center py-16">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">video_library</span>
              <p className="font-headline font-bold text-lg mb-2">Sin recursos todavía</p>
              <p className="text-on-surface-variant text-sm mb-6 max-w-xs mx-auto">
                Creá una carpeta y agregá videos de Vimeo o Drive, PDFs, imágenes o links.
              </p>
              <button onClick={abrirNuevaCarpeta} className="btn-primary inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">create_new_folder</span>
                Crear primera carpeta
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal recurso ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">
                {editando ? 'Editar recurso' : 'Nuevo recurso'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Tipo</label>
              <div className="grid grid-cols-4 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all text-[11px] font-bold ${
                      form.tipo === t.value
                        ? 'bg-primary/15 border-primary/50 text-primary'
                        : 'bg-surface-variant border-transparent text-on-surface-variant hover:border-outline-variant/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Título</label>
              <input
                type="text" required value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="input-field"
                placeholder="Ej: Clase 1 — Introducción a Audaces"
              />
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                {form.tipo === 'video' ? 'Link del video' : form.tipo === 'pdf' ? 'URL del PDF' : form.tipo === 'imagen' ? 'URL de la imagen' : 'URL'}
              </label>
              <input
                type="url" required value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder={tipoConf(form.tipo)?.placeholder || 'https://...'}
              />
              {form.url && detectarFuente(form.url) === 'drive' && (
                <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Google Drive detectado — el archivo debe ser público ("Cualquiera con el link")
                </p>
              )}
              {form.url && form.tipo === 'video' && extractVimeoId(form.url) && (
                <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Vimeo ID: {extractVimeoId(form.url)}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción (opcional)</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                className="input-field resize-none" rows={2}
                placeholder="Breve descripción del contenido..."
              />
            </div>

            {/* Carpeta + Orden */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Carpeta</label>
                <select
                  value={form.carpeta_id}
                  onChange={e => setForm(f => ({ ...f, carpeta_id: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Sin carpeta</option>
                  {carpetas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input
                  type="number" min={0} value={form.orden}
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
                  className="input-field" placeholder="0"
                />
              </div>
            </div>

            {/* Activo toggle */}
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <div
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium">
                {form.activo ? 'Visible para alumnos activos' : 'Oculto (solo admin lo ve)'}
              </span>
            </label>

            {error && (
              <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{error}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal carpeta ─────────────────────────────────────────────────── */}
      {showModalCarpeta && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <form
            onSubmit={handleGuardarCarpeta}
            className="bg-surface-container w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">create_new_folder</span>
                {editandoCarpeta ? 'Editar carpeta' : 'Nueva carpeta'}
              </h3>
              <button type="button" onClick={() => setShowModalCarpeta(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre</label>
              <input
                type="text" required autoFocus value={formCarpeta.nombre}
                onChange={e => setFormCarpeta(f => ({ ...f, nombre: e.target.value }))}
                className="input-field"
                placeholder="Ej: Módulo 1, Materiales Extra, Bonus..."
              />
            </div>

            {errorCarpeta && (
              <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{errorCarpeta}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModalCarpeta(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardandoCarpeta} className="btn-primary flex-1">
                {guardandoCarpeta ? 'Guardando...' : editandoCarpeta ? 'Guardar' : 'Crear carpeta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
