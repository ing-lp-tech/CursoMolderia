import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const TIPOS = [
  { value: 'video', label: 'Video (Vimeo)', icon: 'play_circle' },
  { value: 'pdf',   label: 'PDF / Documento', icon: 'picture_as_pdf' },
  { value: 'link',  label: 'Link / Sitio web', icon: 'link' },
];

const MODULOS = [
  { value: null, label: 'General (sin módulo)' },
  { value: 1,   label: 'Módulo 1' },
  { value: 2,   label: 'Módulo 2' },
  { value: 3,   label: 'Módulo 3' },
  { value: 4,   label: 'Módulo 4' },
  { value: 5,   label: 'Módulo 5' },
  { value: 6,   label: 'Módulo 6' },
  { value: 7,   label: 'Módulo 7' },
  { value: 8,   label: 'Módulo 8' },
  { value: 9,   label: 'Módulo 9' },
];

function extractVimeoId(url) {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

async function fetchVimeoThumbnail(url) {
  try {
    const id = extractVimeoId(url);
    if (!id) return null;
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=640`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch {
    return null;
  }
}

const FORM_INICIAL = { titulo: '', descripcion: '', tipo: 'video', url: '', modulo: '', orden: 0, activo: true };

export default function RecursosPage() {
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null); // null = nuevo
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => { cargarRecursos(); }, []);

  // Cargar thumbnails de Vimeo cuando lleguen los recursos
  useEffect(() => {
    if (recursos.length === 0) return;
    recursos.filter(r => r.tipo === 'video').forEach(async (r) => {
      if (thumbnails[r.id]) return;
      const thumb = await fetchVimeoThumbnail(r.url);
      if (thumb) setThumbnails(prev => ({ ...prev, [r.id]: thumb }));
    });
  }, [recursos]);

  async function cargarRecursos() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .order('modulo', { ascending: true, nullsFirst: false })
        .order('orden', { ascending: true });
      if (error) throw error;
      setRecursos(data || []);
    } catch (e) {
      console.error('[Recursos] Error al cargar:', e.message);
      // Si la tabla no existe todavía, no crashear
    } finally {
      setLoading(false);
    }
  }

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_INICIAL);
    setError('');
    setShowModal(true);
  }

  function abrirEditar(r) {
    setEditando(r.id);
    setForm({
      titulo: r.titulo,
      descripcion: r.descripcion || '',
      tipo: r.tipo,
      url: r.url,
      modulo: r.modulo ?? '',
      orden: r.orden,
      activo: r.activo,
    });
    setError('');
    setShowModal(true);
  }

  function handleUrlChange(url) {
    setForm(f => ({ ...f, url }));
  }

  function handleTipoChange(tipo) {
    setForm(f => ({ ...f, tipo }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');

    // Timeout de seguridad: si la petición a Supabase queda bloqueada por CSP
    // u otro motivo, el fetch puede quedar pendiente indefinidamente.
    // Este timer garantiza que el botón siempre se desbloquea.
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Tiempo de espera agotado (15s). Verificá tu conexión o los permisos de la tabla.')),
        15_000
      );
    });

    try {
      if (!form.titulo.trim() || !form.url.trim()) {
        setError('El título y la URL son obligatorios');
        return;
      }
      if (form.tipo === 'video' && !extractVimeoId(form.url)) {
        setError('URL de Vimeo inválida. Usá el formato https://vimeo.com/XXXXXXX');
        return;
      }

      const payload = {
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo:        form.tipo,
        url:         form.url.trim(),
        modulo:      form.modulo === '' || form.modulo === null ? null : Number(form.modulo),
        orden:       Number(form.orden) || 0,
        activo:      form.activo,
      };

      const dbCall = editando
        ? supabase.from('recursos').update(payload).eq('id', editando)
        : supabase.from('recursos').insert(payload);

      // Corre la petición en carrera contra el timeout
      const { error: err } = await Promise.race([dbCall, timeoutPromise]);

      if (err) {
        if (err.message?.includes('relation') || err.message?.includes('does not exist')) {
          setError('La tabla "recursos" no existe. Ejecutá supabase/07_tabla_recursos.sql en el SQL Editor de Supabase.');
        } else if (err.message?.includes('row-level security') || err.message?.includes('violates') || err.code === '42501' || err.code === 'PGRST301') {
          setError('Sin permisos de escritura. Ejecutá en Supabase SQL Editor:\nGRANT SELECT, INSERT, UPDATE, DELETE ON public.recursos TO authenticated;');
        } else {
          setError(`Error al guardar: ${err.message}`);
        }
        return;
      }

      setShowModal(false);
      await cargarRecursos();
    } catch (ex) {
      setError(ex?.message || 'Error inesperado al guardar.');
    } finally {
      clearTimeout(timeoutId);
      setGuardando(false);
    }
  }


  async function toggleActivo(r) {
    await supabase.from('recursos').update({ activo: !r.activo }).eq('id', r.id);
    setRecursos(prev => prev.map(x => x.id === r.id ? { ...x, activo: !r.activo } : x));
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este recurso?')) return;
    await supabase.from('recursos').delete().eq('id', id);
    setRecursos(prev => prev.filter(r => r.id !== id));
  }

  const tipoIcon = t => TIPOS.find(x => x.value === t)?.icon || 'link';
  const activos = recursos.filter(r => r.activo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold">Recursos del Curso</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {recursos.length} recursos · {activos} activos — visibles para alumnos activos
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          Agregar recurso
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Videos', icon: 'play_circle', count: recursos.filter(r => r.tipo === 'video').length, color: 'text-primary' },
          { label: 'PDFs',   icon: 'picture_as_pdf', count: recursos.filter(r => r.tipo === 'pdf').length, color: 'text-secondary' },
          { label: 'Links',  icon: 'link', count: recursos.filter(r => r.tipo === 'link').length, color: 'text-tertiary' },
        ].map(s => (
          <div key={s.label} className="card border border-outline-variant/20 flex items-center gap-3 py-3">
            <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
            <div>
              <p className="font-headline font-bold text-xl">{s.count}</p>
              <p className="text-xs text-on-surface-variant">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lista de recursos */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl">refresh</span>
        </div>
      ) : recursos.length === 0 ? (
        <div className="card border border-outline-variant/20 text-center py-16">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">video_library</span>
          <p className="font-headline font-bold text-lg mb-2">Sin recursos todavía</p>
          <p className="text-on-surface-variant text-sm mb-6">Agregá videos de Vimeo, PDFs o links para que los alumnos los vean en su portal.</p>
          <button onClick={abrirNuevo} className="btn-primary inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            Agregar primer recurso
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {recursos.map(r => {
            return (
              <div
                key={r.id}
                className={`bg-surface-container border rounded-xl p-4 transition-all ${
                  r.activo ? 'border-outline-variant/20' : 'border-outline-variant/10 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon + mini preview */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    r.tipo === 'video' ? 'bg-primary/15' : r.tipo === 'pdf' ? 'bg-secondary/15' : 'bg-tertiary/15'
                  }`}>
                    <span className={`material-symbols-outlined text-xl ${
                      r.tipo === 'video' ? 'text-primary' : r.tipo === 'pdf' ? 'text-secondary' : 'text-tertiary'
                    }`}>{tipoIcon(r.tipo)}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{r.titulo}</p>
                      {r.modulo && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full">
                          Módulo {r.modulo}
                        </span>
                      )}
                      {!r.activo && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-error/70 bg-error/10 px-2 py-0.5 rounded-full">
                          Oculto
                        </span>
                      )}
                    </div>
                    {r.descripcion && (
                      <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{r.descripcion}</p>
                    )}
                    <p className="text-[10px] text-on-surface-variant/50 mt-1 truncate font-mono">{r.url}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActivo(r)}
                      title={r.activo ? 'Ocultar a alumnos' : 'Mostrar a alumnos'}
                      className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-base">
                        {r.activo ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                    <button
                      onClick={() => abrirEditar(r)}
                      className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => eliminar(r.id)}
                      className="p-2 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>

                {/* Mini Vimeo thumbnail (sin iframe para evitar prompt de login) */}
                {r.tipo === 'video' && (
                  <div className="mt-3 rounded-xl overflow-hidden bg-black relative" style={{ aspectRatio: '16/9', maxHeight: '180px' }}>
                    {thumbnails[r.id] ? (
                      <img src={thumbnails[r.id]} alt={r.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary/30">movie</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-[#1a237e]" style={{ marginLeft: '3px' }}>play_arrow</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal agregar/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardar}
            className="bg-surface-container w-full max-w-lg rounded-2xl p-6 space-y-4 border border-outline-variant/30 my-4"
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
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleTipoChange(t.value)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all text-xs font-bold ${
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
                type="text"
                required
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="input-field"
                placeholder="Ej: Clase 1 — Introducción a Audaces"
              />
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                {form.tipo === 'video' ? 'Link de Vimeo' : form.tipo === 'pdf' ? 'URL del PDF' : 'URL del sitio'}
              </label>
              <input
                type="url"
                required
                value={form.url}
                onChange={e => handleUrlChange(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder={
                  form.tipo === 'video'
                    ? 'https://vimeo.com/1180202976'
                    : form.tipo === 'pdf'
                    ? 'https://drive.google.com/file/d/...'
                    : 'https://...'
                }
              />
              {form.tipo === 'video' && form.url && !extractVimeoId(form.url) && (
                <p className="text-xs text-error mt-1">No se reconoce como URL de Vimeo válida</p>
              )}
              {form.tipo === 'video' && extractVimeoId(form.url) && (
                <p className="text-xs text-secondary mt-1">✓ Vimeo ID detectado: {extractVimeoId(form.url)}</p>
              )}
            </div>

            {/* Confirmación visual Vimeo — sin iframe (evita el "Inicie sesión") */}
            {form.tipo === 'video' && extractVimeoId(form.url) && (
              <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-primary text-2xl">play_circle</span>
                <div>
                  <p className="text-sm font-bold text-primary">Video Vimeo detectado</p>
                  <p className="text-xs text-on-surface-variant font-mono">ID: {extractVimeoId(form.url)}</p>
                </div>
              </div>
            )}

            {/* Descripción */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción (opcional)</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Breve descripción del contenido..."
              />
            </div>

            {/* Módulo y Orden */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Módulo</label>
                <select
                  value={form.modulo}
                  onChange={e => setForm(f => ({ ...f, modulo: e.target.value }))}
                  className="input-field"
                >
                  {MODULOS.map(m => (
                    <option key={m.value ?? 'null'} value={m.value ?? ''}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={form.orden}
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))}
                  className="input-field"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Activo toggle */}
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <div
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.activo ? 'bg-primary' : 'bg-surface-variant'}`}
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

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar recurso'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
