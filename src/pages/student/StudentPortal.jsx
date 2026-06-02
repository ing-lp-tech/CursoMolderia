import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CostosCalculadora from '../../components/CostosCalculadora';

const TIPO_ICON  = { video: 'play_circle', pdf: 'picture_as_pdf', imagen: 'image', link: 'link' };
const TIPO_COLOR = { video: 'text-primary', pdf: 'text-secondary', imagen: 'text-tertiary', link: 'text-tertiary' };
const TIPO_BG    = { video: 'bg-primary/15', pdf: 'bg-secondary/15', imagen: 'bg-tertiary/15', link: 'bg-tertiary/15' };

// ── Helpers URL ───────────────────────────────────────────────────────────────

function extractVimeoId(url) {
  const m = url?.match(/vimeo\.com\/(?:video\/)?([\d]+)(?:\/([a-f0-9]+))?/);
  return m ? { id: m[1], hash: m[2] || null } : null;
}

function extractDriveId(url) {
  const m = url?.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function detectarFuente(url) {
  if (!url) return null;
  if (/vimeo\.com/.test(url))         return 'vimeo';
  if (/drive\.google\.com/.test(url)) return 'drive';
  return 'otro';
}

function getVimeoEmbed(url) {
  const info = extractVimeoId(url);
  if (!info) return null;
  const base = `https://player.vimeo.com/video/${info.id}?badge=0&autopause=0&quality_selector=1&player_id=0&autoplay=1`;
  return info.hash ? `${base}&h=${info.hash}` : base;
}

function getDriveEmbedUrl(url) {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

function getDriveImageSrc(url) {
  const id = extractDriveId(url);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
}

function getVideoEmbedUrl(url) {
  const fuente = detectarFuente(url);
  if (fuente === 'vimeo') return getVimeoEmbed(url);
  if (fuente === 'drive') return getDriveEmbedUrl(url);
  return null;
}

async function fetchVimeoThumbnail(url) {
  try {
    const info = extractVimeoId(url);
    if (!info) return null;
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${info.id}${info.hash ? '/' + info.hash : ''}&width=640`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch { return null; }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function StudentPortal() {
  const { user, perfil, loading, signOut } = useAuth();
  const nombre = perfil?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Estudiante';

  const [activeTab,       setActiveTab]       = useState('recursos');
  const [recursos,        setRecursos]        = useState([]);
  const [carpetas,        setCarpetas]        = useState([]);
  const [loadingRecursos, setLoadingRecursos] = useState(true);
  const [videoAbierto,    setVideoAbierto]    = useState(null);
  const [thumbnails,      setThumbnails]      = useState({});

  useEffect(() => {
    if (!perfil?.activo) { setLoadingRecursos(false); return; }
    let mounted = true;

    async function fetchData() {
      try {
        const [{ data: res }, { data: caps }] = await Promise.all([
          supabase.from('recursos').select('*').eq('activo', true).order('orden', { ascending: true }),
          supabase.from('carpetas').select('*').order('orden', { ascending: true }),
        ]);
        if (mounted) {
          setRecursos(res || []);
          setCarpetas(caps || []);
        }
      } catch (err) {
        console.error('[StudentPortal] Fetch error:', err);
      } finally {
        if (mounted) setLoadingRecursos(false);
      }
    }

    fetchData();
    return () => { mounted = false; };
  }, [perfil?.activo]);

  // Thumbnails: Vimeo via API, imágenes Drive directo
  useEffect(() => {
    recursos.forEach(async r => {
      if (thumbnails[r.id]) return;
      if (r.tipo === 'video' && detectarFuente(r.url) === 'vimeo') {
        const thumb = await fetchVimeoThumbnail(r.url);
        if (thumb) setThumbnails(prev => ({ ...prev, [r.id]: thumb }));
      }
      if (r.tipo === 'imagen') {
        const src = detectarFuente(r.url) === 'drive' ? getDriveImageSrc(r.url) : r.url;
        if (src) setThumbnails(prev => ({ ...prev, [r.id]: src }));
      }
    });
  }, [recursos]);

  // Agrupar recursos por carpeta_id
  const grupos     = {};
  const sinCarpeta = [];
  recursos.forEach(r => {
    if (r.carpeta_id) {
      grupos[r.carpeta_id] = grupos[r.carpeta_id] || [];
      grupos[r.carpeta_id].push(r);
    } else {
      sinCarpeta.push(r);
    }
  });

  // Carpetas con recursos (orden de display)
  const carpetasConItems = carpetas.filter(c => (grupos[c.id] || []).length > 0);

  // Estado de cuál carpeta está abierta (accordion estudiante)
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);
  function toggleCarpetaEstudiante(id) {
    setCarpetaAbierta(prev => prev === id ? null : id);
  }

  // ── Lightbox de video ─────────────────────────────────────────────────────

  const embedAbierto = videoAbierto ? getVideoEmbedUrl(videoAbierto.url) : null;

  // ── Render tarjeta de recurso ─────────────────────────────────────────────

  function renderCard(r) {
    const fuente   = detectarFuente(r.url);
    const esVideo  = r.tipo === 'video';
    const esImagen = r.tipo === 'imagen';
    const esPdf    = r.tipo === 'pdf';
    const esLink   = r.tipo === 'link';

    // Preview: video clickeable (abre lightbox), imagen directa, o icono para pdf/link
    const renderPreview = () => {
      if (esVideo) {
        return (
          <div
            className="relative cursor-pointer bg-black"
            style={{ aspectRatio: '16/9' }}
            onClick={() => setVideoAbierto(r)}
          >
            {thumbnails[r.id] ? (
              <img src={thumbnails[r.id]} alt={r.titulo} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-primary/40">movie</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl text-[#1a237e]" style={{ marginLeft: '4px' }}>play_arrow</span>
              </div>
            </div>
            {fuente === 'drive' && (
              <span className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-widest text-white/80 bg-black/50 px-1.5 py-0.5 rounded-full">
                Drive
              </span>
            )}
          </div>
        );
      }

      if (esImagen && thumbnails[r.id]) {
        return (
          <a href={r.url} target="_blank" rel="noreferrer noopener">
            <div className="relative overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
              <img src={thumbnails[r.id]} alt={r.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="material-symbols-outlined text-white text-3xl">open_in_new</span>
              </div>
            </div>
          </a>
        );
      }

      return (
        <div className={`flex items-center justify-center ${TIPO_BG[r.tipo] || 'bg-surface-variant'}`} style={{ aspectRatio: '16/9' }}>
          <span className={`material-symbols-outlined text-5xl ${TIPO_COLOR[r.tipo] || 'text-on-surface-variant'}`}>
            {TIPO_ICON[r.tipo] || 'link'}
          </span>
        </div>
      );
    };

    const renderAccion = () => {
      if (esVideo) {
        return (
          <button onClick={() => setVideoAbierto(r)} className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
            <span className="material-symbols-outlined text-base">play_circle</span>
            Ver video
          </button>
        );
      }
      if (esImagen) {
        return (
          <a href={r.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-xs font-bold text-tertiary hover:text-tertiary/80 transition-colors">
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Ver imagen
          </a>
        );
      }
      if (esPdf) {
        // PDFs de Drive usan /preview, otros abren directo
        const href = fuente === 'drive' ? getDriveEmbedUrl(r.url) : r.url;
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-xs font-bold text-secondary hover:text-secondary/80 transition-colors">
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            Abrir PDF
          </a>
        );
      }
      return (
        <a href={r.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-xs font-bold text-tertiary hover:text-tertiary/80 transition-colors">
          <span className="material-symbols-outlined text-base">open_in_new</span>
          Abrir link
        </a>
      );
    };

    return (
      <div key={r.id} className="bg-surface-container border border-outline-variant/20 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group">
        {renderPreview()}
        <div className="p-4">
          <h3 className="font-headline font-bold text-sm mb-1 line-clamp-2">{r.titulo}</h3>
          {r.descripcion && (
            <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{r.descripcion}</p>
          )}
          {renderAccion()}
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-16">
      {/* Top bar */}
      <header className="h-16 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">architecture</span>
          <span className="font-headline font-black text-primary uppercase tracking-tighter">Moldi Tex</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-on-surface-variant text-sm hidden sm:block">{user?.email}</span>
          <button onClick={signOut} className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors text-sm font-bold">
            <span className="material-symbols-outlined text-xl">logout</span>
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Welcome */}
        <div className="mb-8">
          <span className="badge badge-secondary mb-3">Área de Estudiantes</span>
          <h1 className="font-headline text-3xl md:text-4xl font-bold mt-2">
            Bienvenido, <span className="gradient-text capitalize">{nombre}</span>
          </h1>
          <p className="text-on-surface-variant mt-2">Accedé a los videos y materiales de tu curso.</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
          </div>
        ) : !perfil?.activo ? (
          <div className="card border border-outline-variant/20 text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">lock</span>
            <h2 className="font-headline font-bold text-xl mb-2">Acceso pendiente de activación</h2>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
              Tu cuenta todavía no fue habilitada. Una vez que el administrador la active, vas a poder ver todos los materiales del curso acá.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-outline-variant/20 mb-8">
              {[['recursos', 'Mis Recursos', 'video_library'], ['costos', 'Calculadora de Costos', 'calculate']].map(([val, label, icon]) => (
                <button key={val} onClick={() => setActiveTab(val)}
                  className={`flex items-center gap-2 px-4 py-2.5 font-headline text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
                    activeTab === val ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
                  }`}>
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Costos */}
            {activeTab === 'costos' && (
              <div className="card border border-outline-variant/20">
                <CostosCalculadora estudianteId={user?.id} />
              </div>
            )}

            {/* Tab Recursos */}
            {activeTab === 'recursos' && (
              <>
                {/* Lightbox de video */}
                {videoAbierto && embedAbierto && (
                  <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setVideoAbierto(null)}
                  >
                    <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-headline font-bold text-white text-lg line-clamp-1">{videoAbierto.titulo}</h3>
                        <button onClick={() => setVideoAbierto(null)} className="text-white/60 hover:text-white shrink-0 ml-3">
                          <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                      </div>
                      <div className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                        <iframe
                          src={embedAbierto}
                          className="w-full h-full"
                          style={{ border: 'none' }}
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title={videoAbierto.titulo}
                        />
                      </div>
                      {videoAbierto.descripcion && (
                        <p className="text-white/60 text-sm mt-3">{videoAbierto.descripcion}</p>
                      )}
                    </div>
                  </div>
                )}

                {loadingRecursos ? (
                  <div className="text-center py-20">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary">refresh</span>
                  </div>
                ) : recursos.length === 0 ? (
                  <div className="card border border-outline-variant/20 text-center py-16">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">video_library</span>
                    <p className="font-headline font-bold text-lg mb-2">Pronto habrá contenido disponible</p>
                    <p className="text-on-surface-variant text-sm">El equipo está subiendo los materiales. Volvé pronto.</p>
                  </div>
                ) : (
                  <div className="space-y-3">

                    {/* Carpetas — accordion */}
                    {carpetasConItems.map((c, idx) => {
                      const items   = grupos[c.id] || [];
                      const abierta = carpetaAbierta === c.id;
                      return (
                        <div key={c.id} className="border border-outline-variant/20 rounded-2xl overflow-hidden">

                          {/* Cabecera clickeable */}
                          <button
                            onClick={() => toggleCarpetaEstudiante(c.id)}
                            className="w-full flex items-center gap-4 px-5 py-4 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center font-headline font-bold text-primary text-base shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-headline font-bold text-base truncate">{c.nombre}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {items.length} {items.length === 1 ? 'recurso' : 'recursos'}
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-on-surface-variant shrink-0 text-2xl">
                              {abierta ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>

                          {/* Recursos (solo si está abierta) */}
                          {abierta && (
                            <div className="border-t border-outline-variant/20 p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map(r => renderCard(r))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Sin carpeta */}
                    {sinCarpeta.length > 0 && (() => {
                      const abierta = carpetaAbierta === '__sin__';
                      return (
                        <div className="border border-dashed border-outline-variant/30 rounded-2xl overflow-hidden">
                          <button
                            onClick={() => toggleCarpetaEstudiante('__sin__')}
                            className="w-full flex items-center gap-4 px-5 py-4 bg-surface-container hover:bg-surface-container-high transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined text-xl">folder_special</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-headline font-bold text-base">Material General</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {sinCarpeta.length} {sinCarpeta.length === 1 ? 'recurso' : 'recursos'}
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-on-surface-variant shrink-0 text-2xl">
                              {abierta ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          {abierta && (
                            <div className="border-t border-outline-variant/20 p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sinCarpeta.map(r => renderCard(r))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="text-center mt-12">
          <Link to="/" className="btn-secondary inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">home</span>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
