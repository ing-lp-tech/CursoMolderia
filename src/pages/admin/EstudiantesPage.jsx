import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function EstudiantesPage() {
  // ← Clave: leer 'user' del contexto para saber cuándo la sesión está lista
  const { user } = useAuth();

  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pagosAlumno, setPagosAlumno] = useState([]);

  // Filtro cursada
  const [filterCursada, setFilterCursada] = useState('');

  // Modal: Dar de Alta
  const [showAltaModal, setShowAltaModal] = useState(false);
  const [altaForm, setAltaForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', cursada: 'Cursada 1' });
  const [altaStatus, setAltaStatus] = useState('idle');
  const [altaError, setAltaError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copiadoPass, setCopiadoPass] = useState(false);
  const [altaYaExiste, setAltaYaExiste] = useState(false); // si el alumno ya fue dado de alta

  // Pendientes de Alta (matrículas registradas en Finanzas con datos de alumno)
  const [pendientes, setPendientes] = useState([]);
  const [activeTab, setActiveTab] = useState('activos'); // 'activos' | 'pendientes'

  // Modal: Editar
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ nombre: '', apellido: '', telefono: '', cursada: '' });
  const [editStatus, setEditStatus] = useState('idle');
  const [editError, setEditError] = useState('');

  // Modal: Eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState('idle');
  const [deleteError, setDeleteError] = useState('');

  // Modal: Resetear Contraseña
  const [showPassModal, setShowPassModal] = useState(false);
  const [passStatus, setPassStatus] = useState('idle');
  const [passError, setPassError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [copiadoNewPass, setCopiadoNewPass] = useState(false);
  const [passMode, setPassMode] = useState('random');
  const [customPassInput, setCustomPassInput] = useState('');
  const [customPassError, setCustomPassError] = useState('');
  const [showPasswordDetail, setShowPasswordDetail] = useState(false);
  const [showCustomPassInput, setShowCustomPassInput] = useState(false);

  // ── FETCH — solo cuando 'user' está disponible (sesión JWT lista) ───────────
  useEffect(() => {
    if (!user) return; // esperar a que la sesión esté lista

    let isMounted = true;
    setLoading(true);

    async function fetchEstudiantes() {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('id, nombre, apellido, email, telefono, activo, created_at, ultima_password, cursada')
          .eq('rol', 'estudiante')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (isMounted) setEstudiantes(data || []);
      } catch (err) {
        console.error('[EstudiantesPage] Error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchEstudiantes();
    fetchPendientes();
    return () => { isMounted = false; };
  }, [user]); // ← re-corre cada vez que user cambia (login/navegación)

  async function refrescarLista() {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, email, telefono, activo, created_at, ultima_password, cursada')
      .eq('rol', 'estudiante')
      .order('created_at', { ascending: false });
    setEstudiantes(data || []);
    await fetchPendientes();
  }

  // ── FETCH PENDIENTES (matrículas de Finanzas con alumno_data) ─────────────────
  async function fetchPendientes() {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/finanzas_movimientos?categoria=eq.Matrícula&tipo=eq.ingreso&alumno_data=not.is.null&select=id,fecha,descripcion,monto,alumno_data&order=fecha.desc`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (!res.ok) return;
      const rows = await res.json();
      setPendientes(rows || []);
    } catch (err) {
      console.error('[EstudiantesPage] Error cargando pendientes:', err.message);
    }
  }

  function validarPassword(p) {
    if (p.length < 8) return 'Debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(p)) return 'Debe tener al menos una mayúscula';
    if (!/[0-9]/.test(p)) return 'Debe tener al menos un número';
    return '';
  }

  async function verPagos(est) {
    setSelected(est);
    const { data } = await supabase
      .from('pagos')
      .select('*')
      .eq('estudiante_id', est.id)
      .order('created_at', { ascending: false });
    setPagosAlumno(data || []);
  }

  async function confirmarPago(pagoId) {
    await supabase
      .from('pagos')
      .update({ estado: 'confirmado', confirmado_at: new Date().toISOString() })
      .eq('id', pagoId);
    setPagosAlumno(prev => prev.map(p => p.id === pagoId ? { ...p, estado: 'confirmado' } : p));
  }

  async function toggleActivo(est) {
    const nuevo = !est.activo;
    await supabase.from('perfiles').update({ activo: nuevo }).eq('id', est.id);
    setEstudiantes(prev => prev.map(e => e.id === est.id ? { ...e, activo: nuevo } : e));
    if (selected?.id === est.id) setSelected(prev => ({ ...prev, activo: nuevo }));
  }

  // ── DAR DE ALTA ─────────────────────────────────────────────────────────────
  async function darDeAlta(e) {
    e.preventDefault();
    setAltaStatus('loading');
    setAltaError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const res = await fetch('/api/crear-alumno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...altaForm, cursada: altaForm.cursada || 'Cursada 1' }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error desconocido');

      setTempPassword(json.tempPassword);
      setAltaStatus('success');
      await refrescarLista();
    } catch (err) {
      setAltaError(err.message);
      setAltaStatus('error');
    }
  }

  function abrirAltaDesde(pendiente, yaExiste = false) {
    const d = pendiente.alumno_data || {};
    setAltaForm({
      nombre:   d.nombre   || '',
      apellido: d.apellido || '',
      email:    d.email    || '',
      telefono: d.telefono || '',
      cursada:  d.cursada  || 'Cursada 1',
    });
    setAltaYaExiste(yaExiste);
    setAltaStatus('idle');
    setAltaError('');
    setTempPassword('');
    setCopiadoPass(false);
    setShowAltaModal(true);
  }

  function cerrarAltaModal() {
    setShowAltaModal(false);
    setAltaStatus('idle');
    setAltaError('');
    setTempPassword('');
    setCopiadoPass(false);
    setAltaYaExiste(false);
    setAltaForm({ nombre: '', apellido: '', email: '', telefono: '', cursada: 'Cursada 1' });
  }

  function copiarPassword() {
    navigator.clipboard.writeText(tempPassword);
    setCopiadoPass(true);
    setTimeout(() => setCopiadoPass(false), 2000);
  }

  // ── EDITAR ──────────────────────────────────────────────────────────────────
  function abrirEditar(est) {
    // Buscar si hay datos en finanzas para este alumno
    const finanzasData = pendientes.find(p => p.alumno_data?.email?.toLowerCase() === est.email?.toLowerCase())?.alumno_data || {};

    const nombre = est.nombre || finanzasData.nombre || '';
    const apellido = est.apellido || finanzasData.apellido || '';
    const telefono = est.telefono || finanzasData.telefono || '';
    
    // Preferir cursada de finanzas si en la BD está vacía o es el default 'Cursada 1'
    let cursada = est.cursada;
    if (finanzasData.cursada && (!est.cursada || est.cursada === 'Cursada 1')) {
      cursada = finanzasData.cursada;
    }

    setEditForm({ 
      nombre, 
      apellido, 
      telefono, 
      cursada: cursada || 'Cursada 1' 
    });
    setEditStatus('idle');
    setEditError('');
    setShowEditModal(true);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setEditStatus('loading');
    setEditError('');
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({
          nombre: editForm.nombre.trim(),
          apellido: editForm.apellido.trim(),
          telefono: editForm.telefono.trim() || null,
          cursada: editForm.cursada.trim() || 'Cursada 1',
        })
        .eq('id', selected.id);

      if (error) throw error;

      const updated = { ...selected, nombre: editForm.nombre.trim(), apellido: editForm.apellido.trim(), telefono: editForm.telefono.trim() || null, cursada: editForm.cursada.trim() || 'Cursada 1' };
      setSelected(updated);
      setEstudiantes(prev => prev.map(e => e.id === selected.id ? updated : e));
      setEditStatus('success');
      setTimeout(() => setShowEditModal(false), 800);
    } catch (err) {
      setEditError(err.message);
      setEditStatus('error');
    }
  }

  // ── ELIMINAR ────────────────────────────────────────────────────────────────
  function abrirEliminar(est) {
    setDeleteTarget(est);
    setDeleteStatus('idle');
    setDeleteError('');
    setShowDeleteModal(true);
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    setDeleteStatus('loading');
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const res = await fetch('/api/eliminar-alumno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al eliminar');

      setEstudiantes(prev => prev.filter(e => e.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) { setSelected(null); setPagosAlumno([]); }
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
      setDeleteStatus('error');
    }
  }

  // ── RESETEAR CONTRASEÑA ─────────────────────────────────────────────────────
  function abrirResetPass() {
    setPassStatus('idle');
    setPassError('');
    setNewPassword('');
    setCopiadoNewPass(false);
    setPassMode('random');
    setCustomPassInput('');
    setCustomPassError('');
    setShowCustomPassInput(false);
    setShowPassModal(true);
  }

  async function resetearPassword() {
    if (passMode === 'custom') {
      const err = validarPassword(customPassInput);
      if (err) { setCustomPassError(err); return; }
    }
    setPassStatus('loading');
    setPassError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const body = { userId: selected.id };
      if (passMode === 'custom') body.customPassword = customPassInput;

      const res = await fetch('/api/reset-password-alumno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al resetear');

      setNewPassword(json.newPassword);
      setPassStatus('success');
      setSelected(prev => ({ ...prev, ultima_password: json.newPassword }));
      setEstudiantes(prev => prev.map(e => e.id === selected.id ? { ...e, ultima_password: json.newPassword } : e));
    } catch (err) {
      setPassError(err.message);
      setPassStatus('error');
    }
  }

  function copiarNewPass() {
    navigator.clipboard.writeText(newPassword);
    setCopiadoNewPass(true);
    setTimeout(() => setCopiadoNewPass(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-2xl font-bold">Estudiantes</h2>
          <p className="text-on-surface-variant text-sm">{estudiantes.length} alumnos registrados</p>
        </div>
        <button onClick={() => { setAltaForm({ nombre: '', apellido: '', email: '', telefono: '', cursada: 'Cursada 1' }); setAltaStatus('idle'); setAltaError(''); setTempPassword(''); setCopiadoPass(false); setShowAltaModal(true); }} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Dar de Alta
        </button>
      </div>

      {/* ── Tabs: Alumnos activos / Pendientes de alta ── */}
      <div className="flex gap-1 border-b border-outline-variant/20">
        <button
          onClick={() => setActiveTab('activos')}
          className={`px-5 py-2.5 font-headline text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
            activeTab === 'activos' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
          }`}
        >
          Alumnos ({estudiantes.length})
        </button>
        <button
          onClick={() => setActiveTab('pendientes')}
          className={`px-5 py-2.5 font-headline text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'pendientes' ? 'text-amber-400 border-amber-400' : 'text-on-surface-variant border-transparent hover:text-on-surface'
          }`}
        >
          Pendientes de Alta
          {pendientes.filter(p => !estudiantes.some(e => e.email === p.alumno_data?.email)).length > 0 && (
            <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-black">
              {pendientes.filter(p => !estudiantes.some(e => e.email === p.alumno_data?.email)).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Pendientes de Alta ── */}
      {activeTab === 'pendientes' && (() => {
        const sinAlta = pendientes.filter(p => !estudiantes.some(e => e.email === p.alumno_data?.email));
        const yaActivos = pendientes.filter(p => estudiantes.some(e => e.email === p.alumno_data?.email));
        return (
          <div className="space-y-4">
            <p className="text-xs text-on-surface-variant">
              Matrículas registradas en Finanzas que aún no tienen cuenta de acceso.
            </p>
            {sinAlta.length === 0 && yaActivos.length === 0 ? (
              <div className="card border border-outline-variant/20 py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-3">school</span>
                <p className="font-bold text-sm">No hay matrículas registradas desde Finanzas.</p>
                <p className="text-xs mt-1">Al registrar un ingreso de tipo Matrícula con datos de alumno, aparecerá aquí.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sinAlta.map(p => {
                  const d = p.alumno_data || {};
                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirAltaDesde(p)}
                      className="card border-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/70 flex items-center gap-4 flex-wrap cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center font-headline font-bold text-amber-400 shrink-0 text-lg group-hover:bg-amber-500/30 transition-colors">
                        {(d.nombre?.[0] || d.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{d.nombre} {d.apellido}</p>
                        <p className="text-xs text-on-surface-variant">{d.email}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {d.cursada && <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">{d.cursada}</span>}
                          {d.telefono && <span className="text-[10px] text-on-surface-variant">☎ {d.telefono}</span>}
                          <span className="text-[10px] text-on-surface-variant">📅 {new Date(p.fecha + 'T12:00').toLocaleDateString('es')}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <span className="material-symbols-outlined text-amber-400 text-2xl group-hover:scale-110 transition-transform">how_to_reg</span>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Dar de Alta</span>
                      </div>
                    </div>
                  );
                })}
                {yaActivos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 mt-4">
                      Ya dados de alta ({yaActivos.length})
                    </p>
                    {yaActivos.map(p => {
                      const d = p.alumno_data || {};
                      const estActivo = estudiantes.find(e => e.email === d.email);
                      return (
                        <div
                          key={p.id}
                          onClick={() => abrirAltaDesde(p, true)}
                          className="card border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary/40 flex items-center gap-4 mb-2 cursor-pointer transition-all group"
                        >
                          <div className="w-9 h-9 rounded-full bg-secondary/15 flex items-center justify-center font-bold text-secondary shrink-0 group-hover:bg-secondary/25 transition-colors">
                            {(d.nombre?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{d.nombre} {d.apellido}</p>
                            <p className="text-xs text-on-surface-variant">{d.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Activo ✓</span>
                            <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-secondary transition-colors">arrow_forward_ios</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Tab: Alumnos activos ── */}
      {activeTab === 'activos' && (
        <>
      {/* Filtro de cursada — siempre visible en tab Alumnos */}
      {(() => {
        const cursadas = [...new Set(estudiantes.map(e => e.cursada).filter(Boolean))].sort();
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Cursada:</span>
            <button
              onClick={() => setFilterCursada('')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                !filterCursada ? 'bg-primary text-white' : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/30'
              }`}
            >
              Todas ({estudiantes.length})
            </button>
            {cursadas.map(c => (
              <button
                key={c}
                onClick={() => setFilterCursada(filterCursada === c ? '' : c)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  filterCursada === c ? 'bg-secondary text-white' : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/30'
                }`}
              >
                {c} ({estudiantes.filter(e => e.cursada === c).length})
              </button>
            ))}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista */}
        <div className="card border border-outline-variant/20 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">refresh</span>
            </div>
          ) : estudiantes.length === 0 ? (
            <p className="text-center py-10 text-on-surface-variant">No hay estudiantes registrados.</p>
          ) : estudiantes.filter(e => !filterCursada || e.cursada === filterCursada).map(est => (
            <div
              key={est.id}
              onClick={() => verPagos(est)}
              className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all mb-2 ${
                selected?.id === est.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-variant'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-primary shrink-0">
                {(est.nombre?.[0] || est.email[0]).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{est.nombre} {est.apellido}</p>
                <p className="text-xs text-on-surface-variant truncate">{est.email}</p>
                {est.cursada && <p className="text-[10px] text-secondary font-bold uppercase tracking-wide mt-0.5">{est.cursada}</p>}
              </div>
              <span className={`badge ${est.activo ? 'badge-success' : 'badge-outline'}`}>
                {est.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          ))}
        </div>

        {/* Detalle */}
        <div className="card border border-outline-variant/20">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3">person_search</span>
              <p className="text-sm">Selecciona un estudiante para ver sus detalles y pagos.</p>
            </div>
          ) : (
            <div>
              {/* Header del estudiante */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline font-bold text-xl">{selected.nombre} {selected.apellido}</h3>
                  <p className="text-on-surface-variant text-sm">{selected.email}</p>
                  {selected.telefono && <p className="text-on-surface-variant text-sm">{selected.telefono}</p>}
                  {selected.cursada && (
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/20">
                      {selected.cursada}
                    </span>
                  )}
                  <p className="text-xs text-on-surface-variant mt-1">
                    Alta: {new Date(selected.created_at).toLocaleDateString('es')}
                  </p>
                </div>
                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button onClick={() => abrirEditar(selected)} title="Editar datos"
                    className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button onClick={() => toggleActivo(selected)} title={selected.activo ? 'Desactivar' : 'Activar'}
                    className="p-2 hover:bg-surface-variant rounded-lg transition-all text-on-surface-variant hover:text-secondary">
                    <span className="material-symbols-outlined text-base">{selected.activo ? 'person_off' : 'how_to_reg'}</span>
                  </button>
                  <button onClick={abrirResetPass} title="Resetear contraseña"
                    className="p-2 hover:bg-primary/10 rounded-lg transition-all text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-base">lock_reset</span>
                  </button>
                  <button onClick={() => abrirEliminar(selected)} title="Eliminar alumno"
                    className="p-2 hover:bg-error/10 rounded-lg transition-all text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* Estado */}
              <div className="mb-5">
                <span className={`badge ${selected.activo ? 'badge-success' : 'badge-outline'}`}>
                  {selected.activo ? 'Acceso Activo' : 'Acceso Inactivo'}
                </span>
              </div>

              {/* Contraseña actual */}
              {selected.ultima_password && (
                <div className="mb-4 p-3 rounded-xl border border-outline-variant/20 bg-surface-variant/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Última contraseña asignada</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-bold text-primary tracking-wider">
                      {showPasswordDetail ? selected.ultima_password : '••••••••'}
                    </code>
                    <button onClick={() => setShowPasswordDetail(v => !v)} className="p-1.5 hover:bg-outline-variant/30 rounded-lg transition-all" title={showPasswordDetail ? 'Ocultar' : 'Ver'}>
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">{showPasswordDetail ? 'visibility_off' : 'visibility'}</span>
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(selected.ultima_password); }} className="p-1.5 hover:bg-outline-variant/30 rounded-lg transition-all" title="Copiar">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">content_copy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Acceso rápido resetear contraseña */}
              <button
                onClick={abrirResetPass}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-outline-variant/20 hover:border-primary/30 hover:bg-primary/5 transition-all mb-5 text-left"
              >
                <span className="material-symbols-outlined text-primary">lock_reset</span>
                <div>
                  <p className="text-sm font-bold">Resetear contraseña</p>
                  <p className="text-xs text-on-surface-variant">Generá o establecé una nueva contraseña para el alumno</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant ml-auto text-sm">arrow_forward_ios</span>
              </button>

              {/* Pagos */}
              <h4 className="font-headline font-bold text-sm uppercase tracking-widest mb-3">Pagos</h4>
              {pagosAlumno.length === 0 ? (
                <p className="text-on-surface-variant text-sm">Este estudiante no tiene pagos registrados.</p>
              ) : (
                <div className="space-y-3">
                  {pagosAlumno.map(p => (
                    <div key={p.id} className="p-3 rounded-xl bg-surface-variant space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{p.concepto}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {p.descuento_aplicado > 0 ? (
                              <span className="text-xs text-on-surface-variant">
                                <span className="line-through">${Number(p.monto_original).toLocaleString()}</span>
                                {' → '}
                                <span className="font-bold text-tertiary">${Number(p.monto).toLocaleString()}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-on-surface-variant font-bold">${Number(p.monto).toLocaleString()}</span>
                            )}
                            <span className="text-xs text-on-surface-variant">
                              · {p.metodo_pago} · {new Date(p.created_at).toLocaleDateString('es')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.comprobante_url && (
                            <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-secondary hover:underline text-xs">Comprobante</a>
                          )}
                          {p.estado === 'pendiente' ? (
                            <button onClick={() => confirmarPago(p.id)} className="badge badge-secondary cursor-pointer hover:bg-secondary/30">Confirmar</button>
                          ) : (
                            <span className={`badge ${p.estado === 'confirmado' ? 'badge-success' : 'badge-error'}`}>{p.estado}</span>
                          )}
                        </div>
                      </div>
                      {p.cupon_codigo && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-tertiary text-sm">local_offer</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-tertiary">Cupón: {p.cupon_codigo}</span>
                          <span className="text-[10px] text-on-surface-variant">— Ahorro: ${Number(p.descuento_aplicado).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* ── MODAL: DAR DE ALTA ── */}
      {showAltaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container w-full max-w-md rounded-2xl p-6 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg">
                  {altaYaExiste ? 'Datos del Alumno' : 'Dar de Alta Alumno'}
                </h3>
                {altaYaExiste && (
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-0.5">Ya dado de alta ✓</p>
                )}
              </div>
              <button type="button" onClick={cerrarAltaModal} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {altaStatus === 'success' ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center py-4">
                  <span className="material-symbols-outlined text-secondary text-4xl mb-2">check_circle</span>
                  <p className="font-bold text-base">¡Alumno creado correctamente!</p>
                  <p className="text-on-surface-variant text-sm mt-1">{altaForm.nombre} ya puede acceder al portal.</p>
                </div>
                <div className="bg-surface-variant rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Contraseña temporal</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono font-bold text-primary tracking-wider bg-surface-container px-3 py-2 rounded-lg">{tempPassword}</code>
                    <button onClick={copiarPassword} className="p-2 hover:bg-outline-variant/30 rounded-lg transition-all" title="Copiar">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">{copiadoPass ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-2">El alumno puede cambiarla desde su perfil en el portal.</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-1">
                  <p className="font-bold text-primary text-xs uppercase tracking-wide">Pasos para el alumno:</p>
                  <p className="text-on-surface-variant text-xs">1. Ir a <span className="font-mono">/login</span></p>
                  <p className="text-on-surface-variant text-xs">2. Email: <span className="font-mono">{altaForm.email}</span></p>
                  <p className="text-on-surface-variant text-xs">3. Usar la contraseña temporal de arriba</p>
                </div>
                <button onClick={cerrarAltaModal} className="btn-primary w-full">Listo</button>
              </div>
            ) : (
              <form onSubmit={darDeAlta} className="space-y-4">
                {[
                  { id: 'nombre',   label: 'Nombre',              type: 'text',  placeholder: 'María' },
                  { id: 'apellido', label: 'Apellido',            type: 'text',  placeholder: 'López' },
                  { id: 'email',    label: 'Email',               type: 'email', placeholder: 'maria@mail.com', required: true },
                  { id: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel',   placeholder: '+54 381...' },
                ].map(f => (
                  <div key={f.id}>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">{f.label}</label>
                    <input required={!!f.required} type={f.type} value={altaForm[f.id]} onChange={e => setAltaForm(p => ({ ...p, [f.id]: e.target.value }))} className="input-field" placeholder={f.placeholder} />
                  </div>
                ))}

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Cursada</label>
                  <input
                    list="cursadas-list"
                    value={altaForm.cursada}
                    onChange={e => setAltaForm(p => ({ ...p, cursada: e.target.value }))}
                    className="input-field"
                    placeholder="Ej: Cursada 1"
                  />
                  <datalist id="cursadas-list">
                    {[...new Set(estudiantes.map(e => e.cursada).filter(Boolean))].map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {altaYaExiste && (
                  <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    <div>
                      <p className="text-sm font-bold text-secondary">Este alumno ya fue dado de alta</p>
                      <p className="text-xs text-on-surface-variant">Podés ver su perfil en la pestaña Alumnos.</p>
                    </div>
                  </div>
                )}

                {altaStatus === 'error' && (
                  <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{altaError}</div>
                )}
                <p className="text-xs text-on-surface-variant">Se generará una contraseña temporal que podrás compartir con el alumno.</p>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={cerrarAltaModal} className="btn-secondary flex-1">Cancelar</button>
                  {!altaYaExiste && (
                    <button type="submit" disabled={altaStatus === 'loading'} className="btn-primary flex-1">
                      {altaStatus === 'loading' ? 'Creando...' : 'Crear Alumno'}
                    </button>
                  )}
                  {altaYaExiste && (
                    <button
                      type="button"
                      onClick={() => { cerrarAltaModal(); setActiveTab('activos'); const est = estudiantes.find(e => e.email === altaForm.email); if (est) verPagos(est); }}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      Ver en Alumnos
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR ── */}
      {showEditModal && selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container w-full max-w-md rounded-2xl p-6 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">Editar Alumno</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="bg-surface-variant rounded-xl px-4 py-3">
              <p className="text-xs text-on-surface-variant">Email (no editable)</p>
              <p className="font-mono text-sm font-bold mt-0.5">{selected.email}</p>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              {[
                { id: 'nombre',   label: 'Nombre',              type: 'text', required: true },
                { id: 'apellido', label: 'Apellido',            type: 'text' },
                { id: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel' },
              ].map(f => (
                <div key={f.id}>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">{f.label}</label>
                  <input required={!!f.required} type={f.type} value={editForm[f.id]} onChange={e => setEditForm(p => ({ ...p, [f.id]: e.target.value }))} className="input-field" />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Cursada</label>
                <input
                  list="cursadas-edit-list"
                  value={editForm.cursada}
                  onChange={e => setEditForm(p => ({ ...p, cursada: e.target.value }))}
                  className="input-field"
                  placeholder="Ej: Cursada 1"
                />
                <datalist id="cursadas-edit-list">
                  {[...new Set(estudiantes.map(e => e.cursada).filter(Boolean))].map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              {editStatus === 'error' && <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{editError}</div>}
              {editStatus === 'success' && (
                <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-3 py-2 text-sm text-secondary flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>Guardado correctamente
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={editStatus === 'loading' || editStatus === 'success'} className="btn-primary flex-1">
                  {editStatus === 'loading' ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESETEAR CONTRASEÑA ── */}
      {showPassModal && selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container w-full max-w-md rounded-2xl p-6 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">Resetear Contraseña</h3>
              <button type="button" onClick={() => setShowPassModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
              </div>
              <p className="font-bold">{selected.nombre} {selected.apellido}</p>
              <p className="text-on-surface-variant text-sm">{selected.email}</p>
            </div>

            {passStatus === 'success' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <p className="text-sm text-secondary font-bold">Nueva contraseña generada</p>
                </div>
                <div className="bg-surface-variant rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Nueva contraseña temporal</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xl font-mono font-bold text-primary tracking-wider bg-surface-container px-3 py-2 rounded-lg">{newPassword}</code>
                    <button onClick={copiarNewPass} className="p-2 hover:bg-outline-variant/30 rounded-lg transition-all" title="Copiar">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">{copiadoNewPass ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant text-center">
                  Compartí esta contraseña con el alumno. Puede cambiarla desde su portal.
                </p>
                <button onClick={() => setShowPassModal(false)} className="btn-primary w-full">Listo</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Toggle: aleatoria / personalizada */}
                <div className="flex rounded-xl overflow-hidden border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setPassMode('random')}
                    className={`flex-1 py-2 text-sm font-bold transition-all ${passMode === 'random' ? 'bg-primary text-white' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                  >
                    Aleatoria
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassMode('custom')}
                    className={`flex-1 py-2 text-sm font-bold transition-all ${passMode === 'custom' ? 'bg-primary text-white' : 'hover:bg-surface-variant text-on-surface-variant'}`}
                  >
                    Personalizada
                  </button>
                </div>

                {passMode === 'random' ? (
                  <p className="text-sm text-on-surface-variant text-center">
                    Se generará una contraseña aleatoria segura. La contraseña actual del alumno dejará de funcionar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">Nueva contraseña</label>
                    <div className="relative">
                      <input
                        type={showCustomPassInput ? 'text' : 'password'}
                        value={customPassInput}
                        onChange={e => { setCustomPassInput(e.target.value); setCustomPassError(''); }}
                        className="input-field pr-10"
                        placeholder="Ej: Moldi2025"
                      />
                      <button type="button" onClick={() => setShowCustomPassInput(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">{showCustomPassInput ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                    {customPassError && <p className="text-xs text-error">{customPassError}</p>}
                    <ul className="text-xs text-on-surface-variant space-y-0.5 mt-1">
                      <li className={`flex items-center gap-1 ${customPassInput.length >= 8 ? 'text-secondary' : ''}`}>
                        <span className="material-symbols-outlined text-xs">{customPassInput.length >= 8 ? 'check_circle' : 'radio_button_unchecked'}</span>
                        Mínimo 8 caracteres
                      </li>
                      <li className={`flex items-center gap-1 ${/[A-Z]/.test(customPassInput) ? 'text-secondary' : ''}`}>
                        <span className="material-symbols-outlined text-xs">{/[A-Z]/.test(customPassInput) ? 'check_circle' : 'radio_button_unchecked'}</span>
                        Al menos una mayúscula
                      </li>
                      <li className={`flex items-center gap-1 ${/[0-9]/.test(customPassInput) ? 'text-secondary' : ''}`}>
                        <span className="material-symbols-outlined text-xs">{/[0-9]/.test(customPassInput) ? 'check_circle' : 'radio_button_unchecked'}</span>
                        Al menos un número
                      </li>
                    </ul>
                  </div>
                )}

                {passStatus === 'error' && (
                  <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{passError}</div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowPassModal(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button type="button" onClick={resetearPassword} disabled={passStatus === 'loading'} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {passStatus === 'loading' ? (
                      <><span className="material-symbols-outlined animate-spin text-sm">refresh</span>Aplicando...</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">lock_reset</span>{passMode === 'custom' ? 'Establecer' : 'Generar'}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: ELIMINAR ── */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container w-full max-w-sm rounded-2xl p-6 space-y-5 border border-error/30">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-error/15 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-error text-3xl">person_remove</span>
              </div>
              <h3 className="font-headline font-bold text-lg">¿Eliminar alumno?</h3>
              <p className="text-on-surface-variant text-sm mt-2">
                Vas a eliminar permanentemente a{' '}
                <span className="font-bold text-on-surface">{deleteTarget.nombre} {deleteTarget.apellido}</span>{' '}
                ({deleteTarget.email}).
              </p>
              <p className="text-error text-xs font-bold mt-2 bg-error/10 px-3 py-2 rounded-lg w-full">
                ⚠ Se eliminarán su cuenta y todos sus pagos. No se puede deshacer.
              </p>
            </div>
            {deleteStatus === 'error' && (
              <div className="bg-error/10 border border-error/30 rounded-xl px-3 py-2 text-sm text-error">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteStatus === 'loading'} className="btn-secondary flex-1">Cancelar</button>
              <button type="button" onClick={confirmarEliminar} disabled={deleteStatus === 'loading'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-error/90 hover:bg-error text-white font-headline font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                {deleteStatus === 'loading' ? (
                  <><span className="material-symbols-outlined animate-spin text-sm">refresh</span>Eliminando...</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">delete</span>Sí, eliminar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
