import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function CertificadoPreview({ nombreCertificado, fecha, firmante1, firmante2, cargo1, cargo2 }) {
  const nombre = nombreCertificado || 'Nombre del Estudiante';
  const fechaFormateada = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      id="certificado-preview"
      style={{
        width: '842px', height: '595px',
        background: '#ffffff', position: 'relative',
        overflow: 'hidden', fontFamily: 'Georgia, serif',
        boxSizing: 'border-box', flexShrink: 0,
      }}
    >
      {/* Top-right decorative corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '220px', height: '220px',
        background: 'linear-gradient(225deg, #1a237e 0%, #283593 50%, transparent 100%)',
        clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
      }} />
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '180px', height: '180px',
        background: 'linear-gradient(225deg, #b89fff 0%, transparent 80%)',
        clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
        opacity: 0.5,
      }} />

      {/* Bottom-left decorative corner */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: '200px', height: '200px',
        background: 'linear-gradient(45deg, #1a237e 0%, #283593 50%, transparent 100%)',
        clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: '160px', height: '160px',
        background: 'linear-gradient(45deg, #b89fff 0%, transparent 80%)',
        clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
        opacity: 0.4,
      }} />

      {/* Gold border */}
      <div style={{ position: 'absolute', inset: '16px', border: '2px solid #b89fff', pointerEvents: 'none' }} />

      {/* Logo + brand top-left */}
      <div style={{ position: 'absolute', top: '32px', left: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #b89fff, #6d23f9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: '14px', fontFamily: 'sans-serif',
        }}>MT</div>
        <div>
          <div style={{ fontFamily: 'sans-serif', fontWeight: 900, fontSize: '13px', letterSpacing: '3px', color: '#1a237e', textTransform: 'uppercase' }}>
            MOLDI TEX
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: '8px', letterSpacing: '2px', color: '#555', textTransform: 'uppercase' }}>
            Academia de Moldería Digital
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: '20px', gap: '0px',
      }}>
        <div style={{ fontFamily: 'sans-serif', fontSize: '13px', letterSpacing: '8px', color: '#444', textTransform: 'uppercase', fontWeight: 400, marginBottom: '4px' }}>
          CERTIFICADO DE
        </div>
        <div style={{ fontFamily: 'sans-serif', fontSize: '38px', letterSpacing: '6px', color: '#1a237e', textTransform: 'uppercase', fontWeight: 900, lineHeight: 1, marginBottom: '16px' }}>
          FINALIZACIÓN
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{ width: '60px', height: '1px', background: '#b89fff' }} />
          <div style={{ color: '#b89fff', fontSize: '14px' }}>✦</div>
          <div style={{ width: '60px', height: '1px', background: '#b89fff' }} />
        </div>

        <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#666', fontStyle: 'italic', marginBottom: '8px' }}>
          otorgado a
        </div>

        <div style={{
          fontFamily: '"Brush Script MT", "Dancing Script", cursive, Georgia, serif',
          fontSize: nombre.length > 22 ? '38px' : '50px',
          color: '#1a237e', lineHeight: 1.1, marginBottom: '6px',
          maxWidth: '520px', textAlign: 'center',
        }}>
          {nombre}
        </div>

        <div style={{ width: '380px', height: '1px', background: '#b89fff', marginBottom: '14px' }} />

        <div style={{ fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 700, color: '#333', letterSpacing: '1px', textAlign: 'center', marginBottom: '4px' }}>
          por completar satisfactoriamente el
        </div>
        <div style={{ fontFamily: 'sans-serif', fontSize: '13px', fontWeight: 900, color: '#1a237e', letterSpacing: '2px', textAlign: 'center', textTransform: 'uppercase', marginBottom: '4px' }}>
          Curso Presencial Audaces Vestuario 7.5
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'italic', color: '#555', marginBottom: '24px' }}>
          {fechaFormateada}
        </div>
      </div>

      {/* Signatures */}
      <div style={{
        position: 'absolute', bottom: '44px', left: 0, right: 0,
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
        paddingLeft: '80px', paddingRight: '80px',
      }}>
        {[
          { nombre: firmante1 || 'Luis P.', cargo: cargo1 || 'Ing. Electrónico · Co-Fundador' },
          { nombre: firmante2 || 'Cristian', cargo: cargo2 || 'Docente · Co-Fundador' },
        ].map((f, idx) => (
          <div key={idx} style={{ textAlign: 'center', minWidth: '160px' }}>
            <div style={{ fontFamily: '"Brush Script MT", cursive, Georgia, serif', fontSize: '22px', color: '#1a237e', lineHeight: 1.2, marginBottom: '4px' }}>
              {f.nombre}
            </div>
            <div style={{ width: '100%', height: '1px', background: '#b89fff', marginBottom: '6px' }} />
            <div style={{ fontFamily: 'sans-serif', fontWeight: 700, fontSize: '10px', color: '#222', letterSpacing: '0.5px' }}>
              {f.nombre}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: '8px', color: '#666', marginTop: '2px', letterSpacing: '0.5px' }}>
              {f.cargo}
            </div>
          </div>
        ))}
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
    const win = window.open('', '_blank', 'width=1000,height=700');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Certificado — ${nombreCertificado}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        @media print { body { margin: 0; } @page { size: A4 landscape; margin: 0; } }
      </style></head><body>${contenido.outerHTML}
      <script>window.onload = function() { window.print(); }<\/script>
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

              {/* Preview container — scaled down */}
              <div
                className="rounded-xl overflow-hidden border border-outline-variant/20 shadow-2xl bg-white"
                style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: '139%', marginBottom: '-160px' }}
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
