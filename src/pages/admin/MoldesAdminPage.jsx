import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { compressImage, sizeKB } from '../../utils/imageCompression';
import { registrarAuditoria } from '../../utils/auditoria';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useAuth } from '../../context/AuthContext';

const SUPER_ADMIN  = 'ing.lp.tech@gmail.com';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const IMG_BUCKET   = 'moldes-imagenes';
const ARC_BUCKET   = 'moldes-archivos';

function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMG_BUCKET}/${path}`;
}

function fmt(n) { return Number(n || 0).toLocaleString('es-AR'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Subida de archivos al storage ────────────────────────────────────────────

async function uploadImagen(file, moldeId, slot) {
  const blob = await compressImage(file);
  const path = `${moldeId}/img_${slot}.jpg`;
  const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

async function uploadArchivo(file, moldeId, tipo, sobreescribir = false) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${moldeId}/${tipo}.${ext}`;
  if (sobreescribir) {
    // Al editar un molde existente: borrar el archivo anterior antes de subir
    await supabase.storage.from(ARC_BUCKET).remove([path]);
  }
  const { error } = await supabase.storage.from(ARC_BUCKET).upload(path, file, { contentType: 'application/octet-stream' });
  if (error) throw error;
  return path;
}

async function eliminarStorage(paths) {
  const imgs = paths.filter(p => p?.startsWith && p).filter(Boolean);
  if (imgs.length) await supabase.storage.from(IMG_BUCKET).remove(imgs.filter(p => !p.startsWith('moldes/')));
  // borramos todo del bucket privado también — por molde_id
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
        {cargando && (
          <span className="material-symbols-outlined text-primary animate-spin text-2xl">refresh</span>
        )}
        {!cargando && preview && (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        )}
        {!cargando && !preview && (
          <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">add_photo_alternate</span>
        )}
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
// TAB CATEGORÍAS
// ════════════════════════════════════════════════════════════════

function TabCategorias() {
  const [categorias,    setCategorias]    = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loading,       setLoading]       = useState(true);

  // Modal categoría
  const [showModalCat, setShowModalCat] = useState(false);
  const [editCatId,    setEditCatId]    = useState(null);
  const [formCat,      setFormCat]      = useState({ nombre: '', slug: '', icono: 'category', orden: 0 });
  const [guardandoCat, setGuardandoCat] = useState(false);

  // Modal subcategoría
  const [showModalSub,  setShowModalSub]  = useState(false);
  const [editSubId,     setEditSubId]     = useState(null);
  const [formSub,       setFormSub]       = useState({ nombre: '', slug: '', categoria_id: '', orden: 0 });
  const [guardandoSub,  setGuardandoSub]  = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from('moldes_categorias').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('moldes_subcategorias').select('*').is('eliminado_en', null).order('orden'),
    ]);
    setCategorias(cats || []);
    setSubcategorias(subs || []);
    setLoading(false);
  }

  // ── CRUD Categoría ───────────────────────────────────────────

  function abrirNuevaCat() {
    setEditCatId(null);
    setFormCat({ nombre: '', slug: '', icono: 'category', orden: categorias.length });
    setShowModalCat(true);
  }

  function abrirEditarCat(c) {
    setEditCatId(c.id);
    setFormCat({ nombre: c.nombre, slug: c.slug, icono: c.icono, orden: c.orden });
    setShowModalCat(true);
  }

  function toSlug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); }

  async function guardarCat(e) {
    e.preventDefault();
    setGuardandoCat(true);
    const payload = { nombre: formCat.nombre.trim(), slug: formCat.slug || toSlug(formCat.nombre), icono: formCat.icono, orden: Number(formCat.orden) };
    const { error } = editCatId
      ? await supabase.from('moldes_categorias').update(payload).eq('id', editCatId)
      : await supabase.from('moldes_categorias').insert(payload);
    setGuardandoCat(false);
    if (error) { alert(error.message); return; }
    setShowModalCat(false);
    cargar();
  }

  async function eliminarCat(c) {
    const count = subcategorias.filter(s => s.categoria_id === c.id).length;
    const msg = count > 0
      ? `¿Enviar "${c.nombre}" a la papelera? Las ${count} subcategorías quedarán sin categoría.`
      : `¿Enviar "${c.nombre}" a la papelera?`;
    if (!confirm(msg)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('moldes_categorias').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', c.id);
    cargar();
  }

  // ── CRUD Subcategoría ────────────────────────────────────────

  function abrirNuevaSub(catId) {
    setEditSubId(null);
    const orden = subcategorias.filter(s => s.categoria_id === catId).length;
    setFormSub({ nombre: '', slug: '', categoria_id: catId, orden });
    setShowModalSub(true);
  }

  function abrirEditarSub(s) {
    setEditSubId(s.id);
    setFormSub({ nombre: s.nombre, slug: s.slug, categoria_id: s.categoria_id, orden: s.orden });
    setShowModalSub(true);
  }

  async function guardarSub(e) {
    e.preventDefault();
    setGuardandoSub(true);
    const payload = { nombre: formSub.nombre.trim(), slug: formSub.slug || toSlug(formSub.nombre), categoria_id: formSub.categoria_id, orden: Number(formSub.orden) };
    const { error } = editSubId
      ? await supabase.from('moldes_subcategorias').update(payload).eq('id', editSubId)
      : await supabase.from('moldes_subcategorias').insert(payload);
    setGuardandoSub(false);
    if (error) { alert(error.message); return; }
    setShowModalSub(false);
    cargar();
  }

  async function eliminarSub(s) {
    if (!confirm(`¿Enviar "${s.nombre}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('moldes_subcategorias').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', s.id);
    cargar();
  }

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNuevaCat} className="btn-primary flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-sm">add</span>Nueva categoría
        </button>
      </div>

      {categorias.map(c => {
        const subs = subcategorias.filter(s => s.categoria_id === c.id);
        return (
          <div key={c.id} className="border border-outline-variant/20 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-surface-container">
              <span className="material-symbols-outlined text-primary text-xl">{c.icono}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{c.nombre}</p>
                <p className="text-xs text-on-surface-variant">{subs.length} subcategorías · orden {c.orden}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => abrirNuevaSub(c.id)} title="Agregar subcategoría"
                  className="p-2 hover:bg-primary/10 rounded-lg transition-all text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-base">add</span>
                </button>
                <button onClick={() => abrirEditarCat(c)}
                  className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button onClick={() => eliminarCat(c)}
                  className="p-2 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>

            <div className="border-t border-outline-variant/10 p-3 flex flex-wrap gap-2">
              {subs.length === 0 && (
                <span className="text-xs text-on-surface-variant/50 italic">Sin subcategorías</span>
              )}
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-1 bg-surface-variant rounded-lg px-2.5 py-1">
                  <span className="text-xs font-medium">{s.nombre}</span>
                  <button onClick={() => abrirEditarSub(s)}
                    className="text-on-surface-variant hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined text-xs">edit</span>
                  </button>
                  <button onClick={() => eliminarSub(s)}
                    className="text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {categorias.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">category</span>
          Sin categorías todavía
        </div>
      )}

      {/* Modal categoría */}
      {showModalCat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <form onSubmit={guardarCat} className="bg-surface-container w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editCatId ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button type="button" onClick={() => setShowModalCat(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre *</label>
              <input type="text" required value={formCat.nombre} className="input-field"
                onChange={e => setFormCat(f => ({ ...f, nombre: e.target.value, slug: toSlug(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Slug</label>
                <input type="text" value={formCat.slug} className="input-field font-mono text-sm"
                  onChange={e => setFormCat(f => ({ ...f, slug: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={formCat.orden} className="input-field"
                  onChange={e => setFormCat(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Ícono (Material Symbols)</label>
              <input type="text" value={formCat.icono} className="input-field font-mono text-sm"
                onChange={e => setFormCat(f => ({ ...f, icono: e.target.value }))} placeholder="category" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModalCat(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardandoCat} className="btn-primary flex-1">
                {guardandoCat ? 'Guardando…' : editCatId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal subcategoría */}
      {showModalSub && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <form onSubmit={guardarSub} className="bg-surface-container w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editSubId ? 'Editar subcategoría' : 'Nueva subcategoría'}</h3>
              <button type="button" onClick={() => setShowModalSub(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría</label>
              <select value={formSub.categoria_id} className="input-field"
                onChange={e => setFormSub(f => ({ ...f, categoria_id: e.target.value }))}>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre *</label>
              <input type="text" required value={formSub.nombre} className="input-field"
                onChange={e => setFormSub(f => ({ ...f, nombre: e.target.value, slug: toSlug(e.target.value) }))}
                placeholder="Ej: Pantalones" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Slug</label>
                <input type="text" value={formSub.slug} className="input-field font-mono text-sm"
                  onChange={e => setFormSub(f => ({ ...f, slug: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={formSub.orden} className="input-field"
                  onChange={e => setFormSub(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowModalSub(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardandoSub} className="btn-primary flex-1">
                {guardandoSub ? 'Guardando…' : editSubId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB MOLDES
// ════════════════════════════════════════════════════════════════

const FORM_INICIAL = {
  categoria_id: '', subcategoria_id: '', titulo: '', descripcion: '',
  precio: '', orden: 0, activo: true,
};

function TabMoldes() {
  const [moldes,        setMoldes]        = useState([]);
  const [categorias,    setCategorias]    = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filtroCat,     setFiltroCat]     = useState('');
  const [filtroSub,     setFiltroSub]     = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [form,      setForm]      = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');

  // Archivos
  const [adsFile,  setAdsFile]  = useState(null);
  const [pdfFile,  setPdfFile]  = useState(null);
  const [imgs,     setImgs]     = useState([null, null, null]);   // File|null por slot
  const [imgBlobs, setImgBlobs] = useState([null, null, null]);   // Blob comprimido
  const adsRef = useRef(); const pdfRef = useRef();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [{ data: m }, { data: cats }, { data: subs }] = await Promise.all([
      supabase.from('moldes').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('moldes_categorias').select('*').is('eliminado_en', null).order('orden'),
      supabase.from('moldes_subcategorias').select('*').is('eliminado_en', null).order('orden'),
    ]);
    setMoldes(m || []);
    setCategorias(cats || []);
    setSubcategorias(subs || []);
    setLoading(false);
  }

  const subsDeCategoria = subcategorias.filter(s => s.categoria_id === form.categoria_id);
  const moldesFiltrados = moldes.filter(m =>
    (!filtroCat || m.categoria_id === filtroCat) &&
    (!filtroSub || m.subcategoria_id === filtroSub)
  );

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_INICIAL, categoria_id: categorias[0]?.id || '' });
    setAdsFile(null); setPdfFile(null);
    setImgs([null, null, null]); setImgBlobs([null, null, null]);
    setError(''); setShowModal(true);
  }

  function abrirEditar(m) {
    setEditando(m);
    setForm({
      categoria_id: m.categoria_id || '',
      subcategoria_id: m.subcategoria_id || '',
      titulo: m.titulo, descripcion: m.descripcion || '',
      precio: m.precio, orden: m.orden, activo: m.activo,
    });
    setAdsFile(null); setPdfFile(null);
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
    if (!editando && !adsFile) { setError('El archivo .ads es obligatorio'); return; }
    setGuardando(true); setError('');

    try {
      const moldeId = editando?.id || crypto.randomUUID();

      // Subir imágenes nuevas
      const paths = [
        editando?.imagen_1_path || null,
        editando?.imagen_2_path || null,
        editando?.imagen_3_path || null,
      ];
      for (let i = 0; i < 3; i++) {
        if (imgBlobs[i]) paths[i] = await uploadImagen(imgs[i], moldeId, i + 1);
      }

      // Subir .ads (sobreescribir si es edición)
      let ads_path = editando?.archivo_ads_path || null;
      if (adsFile) ads_path = await uploadArchivo(adsFile, moldeId, 'patron', !!editando);

      // Subir PDF (sobreescribir si es edición)
      let pdf_path = editando?.archivo_pdf_path || null;
      if (pdfFile) pdf_path = await uploadArchivo(pdfFile, moldeId, 'patron_pdf', !!editando);

      const payload = {
        categoria_id:    form.categoria_id    || null,
        subcategoria_id: form.subcategoria_id || null,
        titulo:          form.titulo.trim(),
        descripcion:     form.descripcion.trim() || null,
        precio:          Number(form.precio),
        activo:          form.activo,
        orden:           Number(form.orden) || 0,
        archivo_ads_path: ads_path,
        archivo_pdf_path: pdf_path,
        imagen_1_path:   paths[0],
        imagen_2_path:   paths[1],
        imagen_3_path:   paths[2],
      };

      const { error: err } = editando
        ? await supabase.from('moldes').update(payload).eq('id', editando.id)
        : await supabase.from('moldes').insert({ id: moldeId, ...payload });

      if (err) { setError(err.message); return; }
      setShowModal(false);
      cargar();
    } catch (ex) {
      setError(ex?.message || 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(m) {
    await supabase.from('moldes').update({ activo: !m.activo }).eq('id', m.id);
    setMoldes(prev => prev.map(x => x.id === m.id ? { ...x, activo: !m.activo } : x));
  }

  async function eliminar(m) {
    if (!confirm(`¿Enviar "${m.titulo}" a la papelera?`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('moldes').update({
      eliminado_en: new Date().toISOString(), eliminado_por: user?.id, eliminado_por_email: user?.email,
    }).eq('id', m.id);
    await registrarAuditoria({ tabla: 'moldes', registroId: m.id, accion: 'eliminacion', descripcion: `Molde "${m.titulo}" enviado a papelera`, datosAnteriores: m });
    setMoldes(prev => prev.filter(x => x.id !== m.id));
  }

  const catNombre = id => categorias.find(c => c.id === id)?.nombre || '';
  const subNombre = id => subcategorias.find(s => s.id === id)?.nombre || '';

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      {/* Filtros + botón */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={filtroCat} onChange={e => { setFiltroCat(e.target.value); setFiltroSub(''); }}
            className="input-field text-sm py-2 w-auto">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {filtroCat && (
            <select value={filtroSub} onChange={e => setFiltroSub(e.target.value)}
              className="input-field text-sm py-2 w-auto">
              <option value="">Todas las subcat.</option>
              {subcategorias.filter(s => s.categoria_id === filtroCat).map(s =>
                <option key={s.id} value={s.id}>{s.nombre}</option>
              )}
            </select>
          )}
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2 text-sm shrink-0">
          <span className="material-symbols-outlined text-sm">add</span>Nuevo molde
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {moldesFiltrados.map(m => {
          const portada = imgUrl(m.imagen_1_path);
          return (
            <div key={m.id} className={`flex items-center gap-3 p-3 border border-outline-variant/20 rounded-xl transition-all ${!m.activo ? 'opacity-50' : ''}`}>
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-surface-variant flex items-center justify-center">
                {portada
                  ? <img src={portada} alt="" className="w-full h-full object-cover" />
                  : <span className="material-symbols-outlined text-on-surface-variant/30 text-2xl">image</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{m.titulo}</p>
                <p className="text-xs text-on-surface-variant">
                  {catNombre(m.categoria_id)}{subNombre(m.subcategoria_id) ? ` › ${subNombre(m.subcategoria_id)}` : ''}
                </p>
                <p className="text-sm font-headline font-bold text-primary">${fmt(m.precio)}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <button onClick={() => toggleActivo(m)} title={m.activo ? 'Ocultar' : 'Mostrar'}
                  className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">{m.activo ? 'visibility' : 'visibility_off'}</span>
                </button>
                <button onClick={() => abrirEditar(m)}
                  className="p-1.5 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button onClick={() => eliminar(m)}
                  className="p-1.5 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          );
        })}
        {moldesFiltrados.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 block mb-3">straighten</span>
            <p className="text-on-surface-variant">Sin moldes todavía</p>
          </div>
        )}
      </div>

      {/* Modal molde */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
          <form onSubmit={handleGuardar}
            className="bg-surface-container w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 border border-outline-variant/30 sm:my-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{editando ? 'Editar molde' : 'Nuevo molde'}</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            {/* Categoría + subcategoría */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría *</label>
                <select value={form.categoria_id} className="input-field"
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value, subcategoria_id: '' }))}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Subcategoría</label>
                <select value={form.subcategoria_id} className="input-field"
                  onChange={e => setForm(f => ({ ...f, subcategoria_id: e.target.value }))}
                  disabled={!form.categoria_id}>
                  <option value="">Sin subcat.</option>
                  {subsDeCategoria.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Título */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Título *</label>
              <input type="text" required value={form.titulo} className="input-field"
                placeholder="Ej: Camisa básica manga larga"
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción</label>
              <textarea value={form.descripcion} rows={3} className="input-field resize-none"
                placeholder="Detallá el molde: talles, características, etc."
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            {/* Precio + Orden */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Precio (ARS) *</label>
                <input type="number" min={0} step={100} value={form.precio} className="input-field"
                  onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Orden</label>
                <input type="number" min={0} value={form.orden} className="input-field"
                  onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} />
              </div>
            </div>

            {/* Archivo .ads */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Archivo .ads {!editando && '*'}
              </label>
              <div
                onClick={() => adsRef.current?.click()}
                className="border border-dashed border-outline-variant/40 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary/50 transition-all"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-xl">folder_open</span>
                <div className="flex-1 min-w-0">
                  {adsFile
                    ? <p className="text-sm font-medium truncate">{adsFile.name} <span className="text-on-surface-variant">({sizeKB(adsFile.size)} KB)</span></p>
                    : editando?.archivo_ads_path
                    ? <p className="text-sm text-secondary">Archivo actual: {editando.archivo_ads_path.split('/').pop()} <span className="text-on-surface-variant">(click para reemplazar)</span></p>
                    : <p className="text-sm text-on-surface-variant">Seleccioná el archivo .ads de Audaces</p>
                  }
                </div>
              </div>
              <input ref={adsRef} type="file" accept=".ads" className="hidden"
                onChange={e => setAdsFile(e.target.files?.[0] || null)} />
            </div>

            {/* Archivo PDF */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">PDF del molde (opcional)</label>
              <div
                onClick={() => pdfRef.current?.click()}
                className="border border-dashed border-outline-variant/40 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-secondary/50 transition-all"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-xl">picture_as_pdf</span>
                <div className="flex-1 min-w-0">
                  {pdfFile
                    ? <p className="text-sm font-medium truncate">{pdfFile.name} <span className="text-on-surface-variant">({sizeKB(pdfFile.size)} KB)</span></p>
                    : editando?.archivo_pdf_path
                    ? <p className="text-sm text-secondary">PDF actual: {editando.archivo_pdf_path.split('/').pop()} <span className="text-on-surface-variant">(click para reemplazar)</span></p>
                    : <p className="text-sm text-on-surface-variant">Seleccioná el PDF (opcional)</p>
                  }
                </div>
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
                onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            </div>

            {/* Imágenes */}
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

            {/* Activo toggle */}
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
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear molde'}
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
  const { moldes_whatsapp_comprobante } = useAppSettings();
  const { user } = useAuth();
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN;
  const [compras,    setCompras]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filtro,     setFiltro]     = useState('en_verificacion');
  const [aprobando,  setAprobando]  = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [motivoMap,  setMotivoMap]  = useState({});

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from('moldes_compras')
      .select('*')
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false });
    setCompras(data || []);
    setLoading(false);
  }

  const comprasFiltradas = compras.filter(c =>
    filtro === 'todas' || c.estado === filtro
  );

  async function aprobar(compra) {
    setAprobando(compra.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/molde-aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ compra_id: compra.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al aprobar'); return; }

      // Construir mensaje de WhatsApp para el comprador
      const lineas = [
        `Hola ${compra.nombre}! ✅ Tu pago fue aprobado.`,
        ``,
        `*${compra.titulo_molde}*`,
        `Aquí están tus archivos de descarga`,
        `_(válidos por 24 horas)_`,
        ``,
      ];
      if (data.ads_url) lineas.push(`📐 Archivo Audaces (.ads):\n${data.ads_url}`);
      if (data.pdf_url) lineas.push(`\n📄 PDF del molde:\n${data.pdf_url}`);
      if (data.imagenes?.length) {
        data.imagenes.forEach((url, i) => lineas.push(`\n🖼 Imagen ${i + 1}:\n${url}`));
      }
      lineas.push(`\n\n¡Gracias por tu compra en Moldi Tex! 🧵`);

      const wa_num = compra.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/${wa_num}?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank');

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
    await supabase.from('moldes_compras').update({
      estado: 'rechazado', rechazo_motivo: motivo || null,
    }).eq('id', compra.id);
    setCompras(prev => prev.map(c => c.id === compra.id ? { ...c, estado: 'rechazado' } : c));
    setRechazando(null);
  }

  async function eliminar(compra) {
    if (!isSuperAdmin) return;
    if (!confirm(`¿Enviar la venta de ${compra.nombre} (${compra.titulo_molde}) a la papelera?`)) return;
    setEliminando(compra.id);
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      const { error } = await supabase.from('moldes_compras').update({
        eliminado_en: new Date().toISOString(), eliminado_por: u?.id, eliminado_por_email: u?.email,
      }).eq('id', compra.id);
      if (error) { alert(error.message); return; }
      await registrarAuditoria({
        tabla: 'moldes_compras', registroId: compra.id, accion: 'eliminacion',
        descripcion: `Venta de "${compra.nombre}" (${compra.titulo_molde}) enviada a papelera`,
        datosAnteriores: compra,
      });
      setCompras(prev => prev.filter(c => c.id !== compra.id));
    } finally {
      setEliminando(null);
    }
  }

  const FILTROS = [
    { key: 'en_verificacion', label: 'En verificación', color: 'text-primary' },
    { key: 'aprobado',        label: 'Aprobadas',        color: 'text-secondary' },
    { key: 'rechazado',       label: 'Rechazadas',       color: 'text-error' },
    { key: 'todas',           label: 'Todas',            color: 'text-on-surface' },
  ];

  const conteo = key => key === 'todas' ? compras.length : compras.filter(c => c.estado === key).length;

  if (loading) return <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
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

      {/* Cards */}
      <div className="space-y-3">
        {comprasFiltradas.map(c => (
          <div key={c.id} className="border border-outline-variant/20 rounded-2xl overflow-hidden">
            {/* Header estado */}
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
                <button
                  onClick={() => eliminar(c)}
                  disabled={eliminando === c.id}
                  title="Eliminar (solo super admin)"
                  className="shrink-0 p-1 rounded-lg hover:bg-error/20 text-error/70 hover:text-error transition-all disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${eliminando === c.id ? 'animate-spin' : ''}`}>
                    {eliminando === c.id ? 'refresh' : 'delete'}
                  </span>
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Info comprador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-bold">{c.nombre}</p>
                  <p className="text-on-surface-variant text-xs">{c.email}</p>
                  <p className="text-on-surface-variant text-xs">{c.whatsapp}</p>
                  {c.provincia && <p className="text-on-surface-variant text-xs">{c.ciudad ? `${c.ciudad}, ` : ''}{c.provincia}</p>}
                  {c.como_llego && <p className="text-on-surface-variant text-xs">Llegó por: {c.como_llego}{c.como_llego_detalle ? ` (${c.como_llego_detalle})` : ''}</p>}
                </div>
                <div>
                  <p className="font-bold truncate">{c.titulo_molde}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.metodo_pago === 'mercadopago' ? '💳 MercadoPago' : '🏦 Transferencia'}
                    {c.descuento_aplicado_pct > 0 && ` · -${c.descuento_aplicado_pct}%`}
                  </p>
                  <p className="font-headline font-bold text-primary text-lg">${fmt(c.monto_cobrado)}</p>
                  {c.mp_payment_id && <p className="text-[10px] text-on-surface-variant font-mono">MP ID: {c.mp_payment_id}</p>}
                  {c.rechazo_motivo && <p className="text-xs text-error mt-1">Motivo: {c.rechazo_motivo}</p>}
                </div>
              </div>

              {/* Acciones */}
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
                    <button
                      onClick={() => rechazar(c)}
                      disabled={rechazando === c.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-error/10 text-error text-sm font-bold hover:bg-error/20 transition-all disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-base">cancel</span>
                      {rechazando === c.id ? 'Rechazando…' : 'Rechazar'}
                    </button>
                    <button
                      onClick={() => aprobar(c)}
                      disabled={aprobando === c.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/15 text-secondary text-sm font-bold hover:bg-secondary/25 transition-all disabled:opacity-50"
                    >
                      {aprobando === c.id
                        ? <><span className="material-symbols-outlined text-base animate-spin">refresh</span>Aprobando…</>
                        : <><span className="material-symbols-outlined text-base">check_circle</span>Aprobar y enviar WhatsApp</>
                      }
                    </button>
                  </div>
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
// PÁGINA PRINCIPAL — 3 tabs
// ════════════════════════════════════════════════════════════════

export default function MoldesAdminPage() {
  const [tab, setTab] = useState('moldes');

  const TABS = [
    { key: 'moldes',     label: 'Moldes',      icon: 'straighten' },
    { key: 'categorias', label: 'Categorías',  icon: 'category' },
    { key: 'ventas',     label: 'Ventas',      icon: 'shopping_bag' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold">Moldes para venta</h1>
        <p className="text-on-surface-variant text-sm mt-1">Administrá el catálogo de moldes Audaces y las ventas</p>
      </div>

      {/* Tabs */}
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

      {tab === 'moldes'     && <TabMoldes />}
      {tab === 'categorias' && <TabCategorias />}
      {tab === 'ventas'     && <TabVentas />}
    </div>
  );
}
