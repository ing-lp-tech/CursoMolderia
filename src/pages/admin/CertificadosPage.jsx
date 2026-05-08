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
      {[[-20, 10], [-28, 2], [-24, 20], [-18, 28]].map(([rx, ry], i) => (
        <ellipse key={`l${i}`} cx={50 + rx} cy={50 + ry} rx="4.5" ry="9"
          fill={color} opacity="0.85"
          transform={`rotate(${-50 + i * 15} ${50 + rx} ${50 + ry})`} />
      ))}
      {/* Laurel derecho */}
      {[[20, 10], [28, 2], [24, 20], [18, 28]].map(([rx, ry], i) => (
        <ellipse key={`r${i}`} cx={50 + rx} cy={50 + ry} rx="4.5" ry="9"
          fill={color} opacity="0.85"
          transform={`rotate(${50 - i * 15} ${50 + rx} ${50 + ry})`} />
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
function CertificadoPreview({ nombreCertificado, fecha, firmante1, firmante2, cargo1, cargo2, modalidad = 'Presencial' }) {
  const nombre = nombreCertificado || 'Nombre del Estudiante';

  const fechaFormateada = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    : new Date().toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

  // 842 × 595 px — A4 landscape (30 × 21 cm)
  return (
    <div id="certificado-preview" style={{
      width: '842px', height: '595px', background: '#ffffff',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'sans-serif', boxSizing: 'border-box', flexShrink: 0,
    }}>

      {/* ── Ilustración de fondo: moldería digital ── */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }} viewBox="0 0 842 595" fill="none">
        {/* Grid técnico */}
        <defs>
          <pattern id="cgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" stroke="#1a1a2e" strokeWidth="0.3"/>
          </pattern>
        </defs>
        <rect width="842" height="595" fill="url(#cgrid)" opacity="0.6"/>

        {/* ── Pieza delantera de corpiño (bodice front) ── */}
        {/* Escote */}
        <path d="M 380,82 Q 421,118 462,82" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Hombros */}
        <line x1="320" y1="82" x2="380" y2="82" stroke="#1a1a2e" strokeWidth="1.6"/>
        <line x1="462" y1="82" x2="522" y2="82" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Sisa izquierda */}
        <path d="M 320,82 Q 295,120 300,178" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Sisa derecha */}
        <path d="M 522,82 Q 547,120 542,178" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Costado izquierdo */}
        <path d="M 300,178 Q 292,290 298,410" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Costado derecho */}
        <path d="M 542,178 Q 550,290 544,410" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Dobladillo */}
        <line x1="298" y1="410" x2="544" y2="410" stroke="#1a1a2e" strokeWidth="1.6"/>
        {/* Línea de cintura (punteada) */}
        <line x1="300" y1="275" x2="542" y2="275" stroke="#1a1a2e" strokeWidth="0.9" strokeDasharray="6,4"/>
        {/* Centro delantero (punteado) */}
        <line x1="421" y1="118" x2="421" y2="410" stroke="#1a1a2e" strokeWidth="0.9" strokeDasharray="4,4"/>
        {/* Seno dart izquierdo */}
        <path d="M 380,275 L 400,220 L 420,275" stroke="#1a1a2e" strokeWidth="0.9"/>
        {/* Seno dart derecho */}
        <path d="M 462,275 L 442,220 L 422,275" stroke="#1a1a2e" strokeWidth="0.9"/>

        {/* ── Líneas de medida ── */}
        {/* Vertical izquierda */}
        <line x1="272" y1="82" x2="272" y2="410" stroke="#1a1a2e" strokeWidth="0.7"/>
        <line x1="267" y1="82"  x2="277" y2="82"  stroke="#1a1a2e" strokeWidth="1"/>
        <line x1="267" y1="275" x2="277" y2="275" stroke="#1a1a2e" strokeWidth="1"/>
        <line x1="267" y1="410" x2="277" y2="410" stroke="#1a1a2e" strokeWidth="1"/>
        {/* Horizontal superior */}
        <line x1="320" y1="58" x2="522" y2="58" stroke="#1a1a2e" strokeWidth="0.7"/>
        <line x1="320" y1="53" x2="320" y2="63" stroke="#1a1a2e" strokeWidth="1"/>
        <line x1="522" y1="53" x2="522" y2="63" stroke="#1a1a2e" strokeWidth="1"/>
        <line x1="421" y1="53" x2="421" y2="63" stroke="#1a1a2e" strokeWidth="1"/>

        {/* ── Puntos de referencia ── */}
        {[[421,118],[320,82],[522,82],[298,410],[544,410],[421,275],[300,178],[542,178]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.8" fill="#1a1a2e"/>
        ))}
        {/* Cruces de referencia */}
        {[[421,82],[421,410]].map(([x,y],i) => (
          <g key={i}>
            <line x1={x-6} y1={y} x2={x+6} y2={y} stroke="#1a1a2e" strokeWidth="1"/>
            <line x1={x} y1={y-6} x2={x} y2={y+6} stroke="#1a1a2e" strokeWidth="1"/>
          </g>
        ))}

        {/* ── Pieza manga (arriba izquierda) ── */}
        <path d="M 120,90 Q 160,60 200,90 Q 220,130 210,190 L 130,190 Q 120,130 120,90 Z" stroke="#1a1a2e" strokeWidth="1.4"/>
        <line x1="160" y1="60" x2="160" y2="190" stroke="#1a1a2e" strokeWidth="0.7" strokeDasharray="4,3"/>
        <line x1="120" y1="145" x2="210" y2="145" stroke="#1a1a2e" strokeWidth="0.7" strokeDasharray="4,3"/>
        <circle cx="160" cy="90" r="2" fill="#1a1a2e"/>

        {/* ── Pieza trasera parcial (derecha) ── */}
        <path d="M 640,100 Q 660,90 700,100 Q 720,180 710,340 L 650,340 Q 640,180 640,100 Z" stroke="#1a1a2e" strokeWidth="1.4"/>
        <line x1="675" y1="90" x2="675" y2="340" stroke="#1a1a2e" strokeWidth="0.7" strokeDasharray="4,3"/>
        <circle cx="675" cy="100" r="2" fill="#1a1a2e"/>
        <circle cx="640" cy="220" r="2" fill="#1a1a2e"/>
        <circle cx="710" cy="220" r="2" fill="#1a1a2e"/>

        {/* ── Flecha de cursor digital (sutil, arriba derecha) ── */}
        <polygon points="758,48 758,88 766,82 774,98 779,96 771,80 780,76" stroke="#1a1a2e" strokeWidth="1" fill="#1a1a2e" opacity="0.5"/>
      </svg>

      {/* ── Esquina superior derecha ── */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '210px', height: '200px', background: C1, clipPath: 'polygon(100% 0, 20% 0, 100% 65%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '160px', height: '150px', background: C2, clipPath: 'polygon(100% 0, 45% 0, 100% 72%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: C3, opacity: 0.75, clipPath: 'polygon(100% 0, 65% 0, 100% 78%)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '210px', background: `linear-gradient(to bottom, ${C1}, transparent)` }} />

      {/* ── Esquina inferior izquierda ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '210px', height: '200px', background: C1, clipPath: 'polygon(0 100%, 0 35%, 80% 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '160px', height: '150px', background: C2, clipPath: 'polygon(0 100%, 0 28%, 55% 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100px', height: '100px', background: C3, opacity: 0.75, clipPath: 'polygon(0 100%, 0 22%, 35% 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '210px', background: `linear-gradient(to top, ${C1}, transparent)` }} />

      {/* ── Borde interior sutil ── */}
      <div style={{ position: 'absolute', inset: '12px', border: `1px solid ${C1}`, opacity: 0.14, pointerEvents: 'none' }} />

      {/* ── Banner inferior ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '38px', background: C1, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: 'white', opacity: 0.85 }}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        </svg>
        <span style={{ color: 'white', fontWeight: 900, fontSize: '10px', letterSpacing: '4px' }}>
          ¡FELICITACIONES POR ESTE GRAN LOGRO!
        </span>
        <svg viewBox="0 0 24 24" style={{ width: '14px', height: '14px', fill: 'white', opacity: 0.85 }}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
        </svg>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingBottom: '50px', paddingTop: '24px', paddingLeft: '60px', paddingRight: '60px' }}>

        {/* Birrete + CERTIFICADO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
          <GradCap size={38} color={C1} />
          <div style={{ fontWeight: 900, fontSize: '42px', letterSpacing: '8px', color: C1, lineHeight: 1 }}>
            CERTIFICADO
          </div>
          <GradCap size={38} color={C1} />
        </div>

        {/* — DE CURSO DE — / MOLDERÍA DIGITAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px' }}>
          <div style={{ width: '50px', height: '1.5px', background: C1 }} />
          <span style={{ fontSize: '10px', letterSpacing: '5px', color: C1, fontWeight: 500 }}>DE CURSO DE</span>
          <div style={{ width: '50px', height: '1.5px', background: C1 }} />
        </div>
        <div style={{ fontWeight: 900, fontSize: '26px', letterSpacing: '5px', color: C1, lineHeight: 1, marginBottom: '8px' }}>
          MOLDERÍA DIGITAL
        </div>

        {/* — ♦ — */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          <div style={{ width: '100px', height: '1.5px', background: C1 }} />
          <span style={{ color: C1, fontSize: '12px' }}>♦</span>
          <div style={{ width: '100px', height: '1.5px', background: C1 }} />
        </div>

        {/* otorgado a + nombre */}
        <div style={{ fontStyle: 'italic', fontSize: '12px', color: '#666', marginBottom: '6px' }}>otorgado a</div>
        <div style={{ fontFamily: '"Brush Script MT", "Dancing Script", cursive',
          fontSize: nombre.length > 22 ? '42px' : '52px',
          color: C1, lineHeight: 1.1, textAlign: 'center', maxWidth: '540px', marginBottom: '5px' }}>
          {nombre}
        </div>
        <div style={{ width: '420px', height: '1.5px', background: C1, opacity: 0.2, marginBottom: '10px' }} />

        {/* Texto de finalización */}
        <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginBottom: '3px' }}>
          por haber completado satisfactoriamente el
        </div>
        <div style={{ fontWeight: 900, fontSize: '12px', color: C1, letterSpacing: '2px', textAlign: 'center', marginBottom: '3px' }}>
          CURSO DE MOLDERÍA DIGITAL.
        </div>
        <div style={{ fontStyle: 'italic', fontSize: '10px', color: '#777', marginBottom: '10px' }}>
          {fechaFormateada}
        </div>

        {/* ── Barra de detalles ── */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0',
          borderTop: `1px solid ${C1}`, borderBottom: `1px solid ${C1}`,
          paddingTop: '7px', paddingBottom: '7px', marginBottom: '12px', opacity: 0.85 }}>
          {[
            { label: 'MODALIDAD', value: `100% ${modalidad}` },
            { label: 'MÓDULOS', value: '8 completados' },
          ].map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center',
              borderRight: i < 1 ? `1px solid ${C1}` : 'none' }}>
              <div style={{ fontSize: '7.5px', fontWeight: 900, letterSpacing: '1.5px', color: C1,
                textTransform: 'uppercase', marginBottom: '2px' }}>{d.label}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#222' }}>{d.value}</div>
            </div>
          ))}
        </div>

        {/* ── Firmas ── */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>

          <div style={{ textAlign: 'center', minWidth: '170px' }}>
            <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: '26px', color: C1, lineHeight: 1.3 }}>
              {firmante1 || 'Luis P.'}
            </div>
            <div style={{ height: '1px', background: C1, opacity: 0.3, margin: '4px 0' }} />
            <div style={{ fontWeight: 900, fontSize: '9px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {firmante1 || 'Luis P.'}
            </div>
            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase', marginTop: '2px' }}>
              {cargo1 || 'Ing. Electrónico · Co-Fundador'}
            </div>
          </div>

          <Seal size={76} color={C1} />

          <div style={{ textAlign: 'center', minWidth: '170px' }}>
            <div style={{ fontFamily: '"Brush Script MT", cursive', fontSize: '26px', color: C1, lineHeight: 1.3 }}>
              {firmante2 || 'Cristian'}
            </div>
            <div style={{ height: '1px', background: C1, opacity: 0.3, margin: '4px 0' }} />
            <div style={{ fontWeight: 900, fontSize: '9px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {firmante2 || 'Cristian'}
            </div>
            <div style={{ fontSize: '8px', color: '#666', textTransform: 'uppercase', marginTop: '2px' }}>
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
  const [modalidad, setModalidad] = useState('Presencial');

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
        body { background: white; display: flex; justify-content: center; align-items: center; }
        @media print {
          body { margin: 0; }
          @page { size: A4 landscape; margin: 0; }
          #certificado-preview { width: 29.7cm !important; height: 21cm !important; }
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
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-outline-variant/10 last:border-0 ${selected?.id === est.id ? 'bg-primary/15 text-primary' : 'hover:bg-surface-variant text-on-surface'
                  }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-headline font-bold text-sm shrink-0 ${selected?.id === est.id ? 'bg-primary/30 text-primary' : 'bg-surface-variant text-on-surface-variant'
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

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Modalidad</label>
                <div className="flex rounded-xl overflow-hidden border border-outline-variant/30">
                  {['Presencial', 'Virtual'].map(m => (
                    <button key={m} type="button" onClick={() => setModalidad(m)}
                      className={`flex-1 py-2 text-xs font-bold transition-all ${modalidad === m ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
                      {m}
                    </button>
                  ))}
                </div>
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
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all ${guardadoOk
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
                style={{ transform: 'scale(0.68)', transformOrigin: 'top left', width: '147%', marginBottom: '-190px' }}
              >
                <CertificadoPreview
                  nombreCertificado={nombreCertificado}
                  fecha={fecha}
                  firmante1={firmante1}
                  firmante2={firmante2}
                  cargo1={cargo1}
                  cargo2={cargo2}
                  modalidad={modalidad}
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
