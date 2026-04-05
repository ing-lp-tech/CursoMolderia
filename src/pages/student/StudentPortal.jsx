import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const TIPO_ICON  = { video: 'play_circle', pdf: 'picture_as_pdf', link: 'link' };
const TIPO_COLOR = { video: 'text-primary', pdf: 'text-secondary', link: 'text-tertiary' };
const TIPO_BG    = { video: 'bg-primary/15', pdf: 'bg-secondary/15', link: 'bg-tertiary/15' };

function extractVimeoId(url) {
  const match = url.match(/vimeo\.com\/(?:video\/)?([\d]+)(?:\/([a-f0-9]+))?/);
  if (!match) return null;
  return { id: match[1], hash: match[2] || null };
}

function getVimeoEmbed(url) {
  const info = extractVimeoId(url);
  if (!info) return null;
  const base = `https://player.vimeo.com/video/${info.id}?badge=0&autopause=0&quality_selector=1&player_id=0&autoplay=1`;
  return info.hash ? `${base}&h=${info.hash}` : base;
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
  } catch {
    return null;
  }
}

export default function StudentPortal() {
  const { user, perfil, signOut } = useAuth();
  const nombre = perfil?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Estudiante';

  const [recursos, setRecursos] = useState([]);
  const [loadingRecursos, setLoadingRecursos] = useState(true);
  const [videoAbierto, setVideoAbierto] = useState(null);
  const [thumbnails, setThumbnails] = useState({}); // { [recurso.id]: thumbnailUrl }

  useEffect(() => {
    let isMounted = true;

    async function fetchRecursos() {
      if (!perfil?.activo) {
        if (isMounted) setLoadingRecursos(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('recursos')
          .select('*')
          .eq('activo', true)
          .order('modulo', { ascending: true, nullsFirst: false })
          .order('orden', { ascending: true });

        if (error) {
          console.error('[StudentPortal] Fetch error:', error);
          throw error;
        }

        if (isMounted) {
          setRecursos(data || []);
        }
      } catch (err) {
        console.error('[StudentPortal] Unhandled exception:', err);
      } finally {
        if (isMounted) {
          setLoadingRecursos(false);
        }
      }
    }

    fetchRecursos();

    return () => {
      isMounted = false;
    };
  }, [perfil?.activo]);

  // Cargar thumbnails de Vimeo cuando lleguen los recursos
  useEffect(() => {
    if (recursos.length === 0) return;
    const videos = recursos.filter(r => r.tipo === 'video');
    videos.forEach(async (r) => {
      const thumb = await fetchVimeoThumbnail(r.url);
      if (thumb) {
        setThumbnails(prev => ({ ...prev, [r.id]: thumb }));
      }
    });
  }, [recursos]);

  // Agrupar por módulo
  const grupos = recursos.reduce((acc, r) => {
    const key = r.modulo ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  const ordenGrupos = Object.keys(grupos).sort((a, b) => Number(a) - Number(b));

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
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors text-sm font-bold"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="mb-8">
          <span className="badge badge-secondary mb-3">Área de Estudiantes</span>
          <h1 className="font-headline text-3xl md:text-4xl font-bold mt-2">
            Bienvenido, <span className="gradient-text capitalize">{nombre}</span>
          </h1>
          <p className="text-on-surface-variant mt-2">Accedé a los videos y materiales de tu curso.</p>
        </div>

        {!perfil?.activo ? (
          /* ── Cuenta no activa ── */
          <div className="card border border-outline-variant/20 text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">lock</span>
            <h2 className="font-headline font-bold text-xl mb-2">Acceso pendiente de activación</h2>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
              Tu cuenta todavía no fue habilitada. Una vez que el administrador la active, vas a poder ver todos los materiales del curso acá.
            </p>
          </div>
        ) : (
          /* ── Contenido activo ── */
          <>
            {/* Video abierto (lightbox) */}
            {videoAbierto && (
              <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setVideoAbierto(null)}>
                <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-headline font-bold text-white text-lg">{videoAbierto.titulo}</h3>
                    <button onClick={() => setVideoAbierto(null)} className="text-white/60 hover:text-white">
                      <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                  </div>
                  <div className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                    <iframe
                      src={getVimeoEmbed(videoAbierto.url)}
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
              <div className="space-y-8">
                {ordenGrupos.map(key => {
                  const modulo = Number(key);
                  const items  = grupos[key];
                  return (
                    <div key={key}>
                      {/* Header del módulo */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-primary text-sm">
                          {modulo === 0 ? '✦' : modulo}
                        </div>
                        <h2 className="font-headline font-bold text-lg">
                          {modulo === 0 ? 'Material General' : `Módulo ${modulo}`}
                        </h2>
                        <div className="flex-1 h-px bg-outline-variant/20" />
                        <span className="text-xs text-on-surface-variant">{items.length} recurso{items.length !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Grid de recursos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(r => {
                          const embedUrl = r.tipo === 'video' ? getVimeoEmbed(r.url) : null;
                          return (
                            <div key={r.id} className="bg-surface-container border border-outline-variant/20 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group">
                              {/* Thumbnail / preview — NUNCA cargamos un iframe aquí (causaría el "Inicie sesión") */}
                              {embedUrl ? (
                                <div
                                  className="relative cursor-pointer bg-black"
                                  style={{ aspectRatio: '16/9' }}
                                  onClick={() => setVideoAbierto(r)}
                                >
                                  {/* Thumbnail estático de Vimeo (sin auth) o fondo degradado */}
                                  {thumbnails[r.id] ? (
                                    <img
                                      src={thumbnails[r.id]}
                                      alt={r.titulo}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                                      <span className="material-symbols-outlined text-5xl text-primary/40">movie</span>
                                    </div>
                                  )}
                                  {/* Play overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                                      <span className="material-symbols-outlined text-4xl text-[#1a237e]" style={{ marginLeft: '4px' }}>play_arrow</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className={`flex items-center justify-center ${TIPO_BG[r.tipo]} border-b border-outline-variant/10`} style={{ aspectRatio: '16/9' }}>
                                  <span className={`material-symbols-outlined text-5xl ${TIPO_COLOR[r.tipo]}`}>{TIPO_ICON[r.tipo]}</span>
                                </div>
                              )}

                              {/* Info */}
                              <div className="p-4">
                                <h3 className="font-headline font-bold text-sm mb-1 line-clamp-2">{r.titulo}</h3>
                                {r.descripcion && (
                                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{r.descripcion}</p>
                                )}

                                {r.tipo === 'video' ? (
                                  <button
                                    onClick={() => setVideoAbierto(r)}
                                    className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-base">play_circle</span>
                                    Ver video
                                  </button>
                                ) : (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className={`flex items-center gap-2 text-xs font-bold transition-colors ${
                                      r.tipo === 'pdf' ? 'text-secondary hover:text-secondary/80' : 'text-tertiary hover:text-tertiary/80'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-base">{TIPO_ICON[r.tipo]}</span>
                                    {r.tipo === 'pdf' ? 'Abrir PDF' : 'Abrir link'}
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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
