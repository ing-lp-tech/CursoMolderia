import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// Colores certificado
const C1 = '#0B1D6A'; // navy oscuro
const C2 = '#1A3499'; // navy medio
const C3 = '#3A5CD6'; // azul acento

// ── Ícono birrete SVG ──────────────────────────────────────────────────────
function GradCap({ size = 58, color = C1 }) {
  return (
    <svg viewBox="0 0 64 52" style={{ width: size, height: size * 0.81 }} fill={color}>
      <polygon points="32,2 62,16 32,30 2,16" />
      <path d="M18,22 L18,38 C18,44 24,48 32,48 C40,48 46,44 46,38 L46,22 L32,30 Z" />
      <line x1="57" y1="16" x2="57" y2="36" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="57" cy="39" r="4" />
    </svg>
  );
}

// ── Sello circular con birrete ─────────────────────────────────────────────
function Seal({ size = 92, color = C1 }) {
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
      {/* Laurel izquierdo */}
      {[[-20,10],[-28,2],[-24,20],[-18,28]].map(([rx,ry],i)=>(
        <ellipse key={`l${i}`} cx={50+rx} cy={50+ry} rx="4.5" ry="9"
          fill={color} opacity="0.85"
          transform={`rotate(${-50+i*15} ${50+rx} ${50+ry})`} />
      ))}
      {/* Laurel derecho */}
      {[[20,10],[28,2],[24,20],[18,28]].map(([rx,ry],i)=>(
        <ellipse key={`r${i}`} cx={50+rx} cy={50+ry} rx="4.5" ry="9"
          fill={color} opacity="0.85"
          transform={`rotate(${50-i*15} ${50+rx} ${50+ry})`} />
      ))}
      <polygon points="50,24 66,33 50,42 34,33" fill={color} />
      <path d="M38,36 L38,49 C38,53 43,57 50,57 C57,57 62,53 62,49 L62,36 L50,42 Z" fill={color} />
      <line x1="63" y1="33" x2="63" y2="44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="63" cy="46" r="2.5" fill={color} />
    </svg>
  );
}

// ── Certificado ────────────────────────────────────────────────────────────
// 600×900 px → proporción 2:3 = 20×30 cm (encuadra perfectamente)
function CertificadoPreview({ nombreCertificado, fecha, firmante1, firmante2, cargo1, cargo2 }) {
  const nombre = nombreCertificado || 'Nombre del Estudiante';
  const fechaFormateada = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      id="certificado-preview"
      style={{ width: '600px', height: '900px', background: '#ffffff', position: 'relative', overflow: 'hidden', fontFamily: 'Georgia, serif', boxSizing: 'border-box', flexShrink: 0 }}
    >
      {/* ── Líneas curvas de fondo (decorativas) ── */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.035 }} viewBox="0 0 600 900" preserveAspectRatio="none">
        {[...Array(10)].map((_, i) => (
          <path key={i} d={`M${-80 + i*88},0 Q${60 + i*88},450 ${-80 + i*88},900`}
            fill="none" stroke={C1} strokeWidth="1.2" />
        ))}
      </svg>

      {/* ── Esquina superior derecha (3 capas) ── */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '240px', height: '320px',
        background: C1, clipPath: 'polygon(100% 0, 20% 0, 100% 55%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '185px', height: '240px',
        background: C2, clipPath: 'polygon(100% 0, 44% 0, 100% 62%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '160px',
        background: C3, opacity: 0.75, clipPath: 'polygon(100% 0, 62% 0, 100% 68%)' }} />
      {/* tira lateral derecha */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '14px', height: '330px',
        background: `linear-gradient(to bottom, ${C1}, transparent)` }} />

      {/* ── Esquina inferior izquierda (3 capas) ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '240px', height: '320px',
        background: C1, clipPath: 'polygon(0 100%, 0 45%, 80% 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '185px', height: '240px',
        background: C2, clipPath: 'polygon(0 100%, 0 38%, 56% 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '120px', height: '160px',
        background: C3, opacity: 0.75, clipPath: 'polygon(0 100%, 0 32%, 38% 100%)' }} />
      {/* tira lateral izquierda */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '14px', height: '330px',
        background: `linear-gradient(to top, ${C1}, transparent)` }} />

      {/* ── Borde interior sutil ── */}
      <div style={{ position: 'absolute', inset: '12px', border: `1px solid ${C1}`, opacity: 0.13, pointerEvents: 'none' }} />

      {/* ── Banner inferior ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px', background: C1, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', fill: 'white', opacity: 0.85 }}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        </svg>
        <span style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '11px', letterSpacing: '3px', color: 'white', textTransform: 'uppercase' }}>
          ¡FELICITACIONES POR ESTE GRAN LOGRO!
        </span>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '52px', paddingBottom: '100px', paddingLeft: '44px', paddingRight: '44px' }}>

        {/* Birrete */}
        <GradCap size={58} color={C1} />
        <div style={{ height: '18px' }} />

        {/* CERTIFICADO */}
        <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '56px', color: C1, letterSpacing: '5px', textTransform: 'uppercase', lineHeight: 1 }}>
          CERTIFICADO
        </div>
        <div style={{ height: '10px' }} />

        {/* — DE CURSO DE — */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '52px', height: '1.5px', background: C1 }} />
          <span style={{ fontFamily: 'sans-serif', fontSize: '12px', letterSpacing: '4px', color: C1, fontWeight: 500 }}>DE CURSO DE</span>
          <div style={{ width: '52px', height: '1.5px', background: C1 }} />
        </div>
        <div style={{ height: '8px' }} />

        {/* MOLDERÍA DIGITAL */}
        <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '36px', color: C1, letterSpacing: '3px', textTransform: 'uppercase', lineHeight: 1 }}>
          MOLDERÍA DIGITAL
        </div>
        <div style={{ height: '20px' }} />

        {/* — ♦ — */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '68px', height: '1.5px', background: C1 }} />
          <span style={{ color: C1, fontSize: '14px', fontFamily: 'sans-serif' }}>♦</span>
          <div style={{ width: '68px', height: '1.5px', background: C1 }} />
        </div>
        <div style={{ height: '22px' }} />

        {/* otorgado a */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#555', fontStyle: 'italic' }}>
          otorgado a
        </div>
        <div style={{ height: '14px' }} />

        {/* Nombre */}
        <div style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive',
          fontSize: nombre.length > 22 ? '52px' : '66px',
          color: C1, lineHeight: 1.1, textAlign: 'center', maxWidth: '480px' }}>
          {nombre}
        </div>
        <div style={{ height: '8px' }} />

        {/* Línea bajo nombre */}
        <div style={{ width: '380px', height: '1.5px', background: C1, opacity: 0.22 }} />
        <div style={{ height: '22px' }} />

        {/* Texto completación */}
        <div style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#555', textAlign: 'center' }}>
          por haber completado satisfactoriamente el
        </div>
        <div style={{ height: '6px' }} />
        <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '13px', color: C1, letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>
          CURSO DE MOLDERÍA DIGITAL.
        </div>
        <div style={{ height: '8px' }} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'italic', color: '#666', textAlign: 'center' }}>
          {fechaFormateada}
        </div>

        {/* Espacio flexible */}
        <div style={{ flex: 1, minHeight: '24px' }} />

        {/* Firmas */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>

          <div style={{ textAlign: 'center', minWidth: '148px' }}>
            <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: '28px', color: C1, lineHeight: 1.3 }}>
              {firmante1 || 'Luis P.'}
            </div>
            <div style={{ width: '100%', height: '1px', background: C1, opacity: 0.35, marginBottom: '6px' }} />
            <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '10px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {firmante1 || 'Luis P.'}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginTop: '2px' }}>
              {cargo1 || 'Ing. Electrónico · Co-Fundador'}
            </div>
          </div>

          <Seal size={90} color={C1} />

          <div style={{ textAlign: 'center', minWidth: '148px' }}>
            <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: '28px', color: C1, lineHeight: 1.3 }}>
              {firmante2 || 'Cristian'}
            </div>
            <div style={{ width: '100%', height: '1px', background: C1, opacity: 0.35, marginBottom: '6px' }} />
            <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '10px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {firmante2 || 'Cristian'}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginTop: '2px' }}>
              {cargo2 || 'Docente · Co-Fundador'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CertificadosPage() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  // Campos editables del certificado
  const [nombreCertificado, setNombreCertificado] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [firmante1, setFirmante1] = useState('Luis P.');
  const [firmante2, setFirmante2] = useState('Cristian');
  const [cargo1, setCargo1] = useState('Ing. Electrónico · Co-Fundador');
  const [cargo2, setCargo2] = useState('Docente · Co-Fundador');

  // Historial de certificados
  const [certHistorial, setCertHistorial] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    supabase
      .from('perfiles')
      .select('id, nombre, apellido, email')
      .eq('rol', 'estudiante')
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .then(({ data }) => { setEstudiantes(data || []); setLoading(false); });
  }, []);

  async function handleSelectEstudiante(est) {
    setSelected(est);
    setNombreCertificado(`${est.nombre || ''} ${est.apellido || ''}`.trim());
    setGuardadoOk(false);

    // Cargar historial de certificados para este estudiante
    const { data } = await supabase
      .from('certificados')
      .select('id, nombre_en_certificado, fecha_emision, created_at')
      .eq('estudiante_id', est.id)
      .order('created_at', { ascending: false });
    setCertHistorial(data || []);
  }

  async function handleEmitirYGuardar() {
    if (!selected || !nombreCertificado.trim()) return;
    setGuardando(true);

    const { error } = await supabase.from('certificados').insert({
      estudiante_id: selected.id,
      nombre_en_certificado: nombreCertificado.trim(),
      fecha_emision: fecha,
      firmante1, firmante2, cargo1, cargo2,
    });

    if (!error) {
      setCertHistorial(prev => [{
        id: Date.now(),
        nombre_en_certificado: nombreCertificado.trim(),
        fecha_emision: fecha,
        created_at: new Date().toISOString(),
      }, ...prev]);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    }

    setGuardando(false);
    handleImprimir();
  }

  function handleImprimir() {
    const contenido = document.getElementById('certificado-preview');
    if (!contenido) return;
    const win = window.open('', '_blank', 'width=700,height=1000');
    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Certificado — ${nombreCertificado}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: white; display: flex; justify-content: center; align-items: flex-start; }
        @media print {
          body { margin: 0; }
          @page { size: 20cm 30cm; margin: 0; }
          #certificado-preview { width: 20cm !important; height: 30cm !important; }
        }
      </style></head><body>
      <div style="transform-origin: top center;">
        ${contenido.outerHTML}
      </div>
      <script>window.onload = function() { setTimeout(function(){ window.print(); }, 600); }<\/script>
      </body></html>`);
    win.document.close();
  }

  const filtrados = estudiantes.filter(e => {
    const q = search.toLowerCase();
    return (
      (e.nombre || '').toLowerCase().includes(q) ||
      (e.apellido || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold">Certificados</h1>
          <p className="text-on-surface-variant text-sm mt-1">Generá certificados de finalización para los estudiantes activos</p>
        </div>
        {selected && (
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-variant text-on-surface hover:bg-outline-variant/40 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all"
          >
            <span className="material-symbols-outlined text-xl">print</span>
            Solo Imprimir
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Panel izquierdo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Student list */}
          <div className="bg-surface-container border border-outline-variant/20 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin">refresh</span>
              </div>
            ) : filtrados.length === 0 ? (
              <p className="text-center py-8 text-on-surface-variant text-sm">Sin resultados</p>
            ) : filtrados.map(est => (
              <button
                key={est.id}
                onClick={() => handleSelectEstudiante(est)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-outline-variant/10 last:border-0 ${
                  selected?.id === est.id ? 'bg-primary/15 text-primary' : 'hover:bg-surface-variant text-on-surface'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-headline font-bold text-sm shrink-0 ${
                  selected?.id === est.id ? 'bg-primary/30 text-primary' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {(est.nombre?.[0] || est.email?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{est.nombre} {est.apellido}</p>
                  <p className="text-xs text-on-surface-variant truncate">{est.email}</p>
                </div>
                {selected?.id === est.id && (
                  <span className="material-symbols-outlined text-primary text-sm shrink-0">check_circle</span>
                )}
              </button>
            ))}
          </div>

          {/* Config fields */}
          {selected && (
            <div className="bg-surface-container border border-outline-variant/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Configuración del Certificado</p>

              {/* Nombre en certificado — EDITABLE */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                  Nombre que aparece en el certificado
                </label>
                <input
                  type="text"
                  value={nombreCertificado}
                  onChange={e => setNombreCertificado(e.target.value)}
                  placeholder="Nombre completo del estudiante"
                  className="input-field text-sm"
                />
                <p className="text-[10px] text-on-surface-variant mt-1">Podés editar el nombre si hay tildes o formato especial.</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Fecha de emisión</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-field" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Firmante 1</label>
                  <input type="text" value={firmante1} onChange={e => setFirmante1(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Cargo 1</label>
                  <input type="text" value={cargo1} onChange={e => setCargo1(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Firmante 2</label>
                  <input type="text" value={firmante2} onChange={e => setFirmante2(e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Cargo 2</label>
                  <input type="text" value={cargo2} onChange={e => setCargo2(e.target.value)} className="input-field text-sm" />
                </div>
              </div>

              {/* Emitir y guardar */}
              <button
                onClick={handleEmitirYGuardar}
                disabled={guardando || !nombreCertificado.trim()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all ${
                  guardadoOk
                    ? 'bg-secondary/20 text-secondary'
                    : 'bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {guardadoOk ? 'check_circle' : guardando ? 'hourglass_top' : 'workspace_premium'}
                </span>
                {guardadoOk ? '¡Guardado!' : guardando ? 'Guardando...' : 'Emitir y Guardar + PDF'}
              </button>

              {/* Historial de certificados emitidos */}
              {certHistorial.length > 0 && (
                <div className="pt-2 border-t border-outline-variant/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Certificados emitidos ({certHistorial.length})
                  </p>
                  <div className="space-y-1">
                    {certHistorial.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-[11px] text-on-surface-variant bg-surface-variant rounded-lg px-2 py-1.5">
                        <span className="material-symbols-outlined text-sm text-primary/60">workspace_premium</span>
                        <span className="flex-1 truncate">{c.nombre_en_certificado}</span>
                        <span className="shrink-0">{new Date(c.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel derecho — preview */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-surface-container border border-outline-variant/20 rounded-xl flex flex-col items-center justify-center py-24 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">workspace_premium</span>
              <p className="font-headline font-bold text-lg mb-2">Seleccioná un estudiante</p>
              <p className="text-on-surface-variant text-sm">La vista previa del certificado aparecerá aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Vista previa</p>
                <button
                  onClick={handleEmitirYGuardar}
                  disabled={guardando || !nombreCertificado.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 text-secondary hover:bg-secondary/30 rounded-lg font-headline font-bold uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {guardando ? 'Guardando...' : 'Descargar PDF'}
                </button>
              </div>

              {/* Preview container — escalado a retrato 20×30 */}
              <div
                className="rounded-xl overflow-hidden border border-outline-variant/20 shadow-2xl bg-white"
                style={{ transform: 'scale(0.60)', transformOrigin: 'top left', width: '100%', marginBottom: '-360px' }}
              >
                <CertificadoPreview
                  nombreCertificado={nombreCertificado}
                  fecha={fecha}
                  firmante1={firmante1}
                  firmante2={firmante2}
                  cargo1={cargo1}
                  cargo2={cargo2}
                />
              </div>

              <p className="text-[10px] text-on-surface-variant text-center mt-2 pt-2">
                Al imprimir, seleccioná "Guardar como PDF" · Orientación Horizontal (Landscape) · Sin márgenes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
