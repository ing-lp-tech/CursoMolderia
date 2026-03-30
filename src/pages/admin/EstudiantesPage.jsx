import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function EstudiantesPage() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pagosAlumno, setPagosAlumno] = useState([]);
  const [showAltaModal, setShowAltaModal] = useState(false);
  const [altaForm, setAltaForm] = useState({ nombre: '', apellido: '', email: '', telefono: '' });
  const [altaStatus, setAltaStatus] = useState('idle');

  useEffect(() => {
    supabase.from('perfiles').select('*').eq('rol', 'estudiante').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setEstudiantes(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function verPagos(est) {
    setSelected(est);
    const { data } = await supabase.from('pagos').select('*').eq('estudiante_id', est.id).order('created_at', { ascending: false });
    setPagosAlumno(data || []);
  }

  async function confirmarPago(pagoId) {
    await supabase.from('pagos').update({ estado: 'confirmado', confirmado_at: new Date().toISOString() }).eq('id', pagoId);
    setPagosAlumno(prev => prev.map(p => p.id === pagoId ? { ...p, estado: 'confirmado' } : p));
  }

  async function toggleActivo(est) {
    const nuevo = !est.activo;
    await supabase.from('perfiles').update({ activo: nuevo }).eq('id', est.id);
    setEstudiantes(prev => prev.map(e => e.id === est.id ? { ...e, activo: nuevo } : e));
    if (selected?.id === est.id) setSelected(prev => ({ ...prev, activo: nuevo }));
  }

  async function darDeAlta(e) {
    e.preventDefault();
    setAltaStatus('loading');
    const password = Math.random().toString(36).slice(-8) + 'A1!';
    const { data, error } = await supabase.auth.admin
      ? await supabase.auth.signUp({ // fallback public signup
          email: altaForm.email,
          password,
          options: { data: { nombre: altaForm.nombre, apellido: altaForm.apellido, telefono: altaForm.telefono, rol: 'estudiante' } },
        })
      : { error: new Error('Usa la función desde el panel de Supabase') };
    if (error) { setAltaStatus('error'); return; }
    // Refresh list
    const { data: newPerfiles } = await supabase.from('perfiles').select('*').eq('rol', 'estudiante').order('created_at', { ascending: false });
    setEstudiantes(newPerfiles || []);
    setAltaStatus('success');
    setTimeout(() => { setShowAltaModal(false); setAltaStatus('idle'); setAltaForm({ nombre: '', apellido: '', email: '', telefono: '' }); }, 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-2xl font-bold">Estudiantes</h2>
          <p className="text-on-surface-variant text-sm">{estudiantes.length} alumnos registrados</p>
        </div>
        <button onClick={() => setShowAltaModal(true)} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Dar de Alta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista */}
        <div className="card border border-outline-variant/20 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <p className="text-center py-10 text-on-surface-variant">Cargando...</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-center py-10 text-on-surface-variant">No hay estudiantes registrados.</p>
          ) : estudiantes.map(est => (
            <div
              key={est.id}
              onClick={() => verPagos(est)}
              className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all mb-2 ${selected?.id === est.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-variant'}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-headline font-bold text-primary shrink-0">
                {(est.nombre?.[0] || est.email[0]).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{est.nombre} {est.apellido}</p>
                <p className="text-xs text-on-surface-variant truncate">{est.email}</p>
              </div>
              <span className={`badge ${est.activo ? 'badge-success' : 'badge-outline'}`}>{est.activo ? 'Activo' : 'Inactivo'}</span>
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
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-headline font-bold text-xl">{selected.nombre} {selected.apellido}</h3>
                  <p className="text-on-surface-variant text-sm">{selected.email}</p>
                  {selected.telefono && <p className="text-on-surface-variant text-sm">{selected.telefono}</p>}
                  <p className="text-xs text-on-surface-variant mt-1">Alta: {new Date(selected.created_at).toLocaleDateString('es')}</p>
                </div>
                <button
                  onClick={() => toggleActivo(selected)}
                  className={`badge cursor-pointer ${selected.activo ? 'badge-error hover:bg-error/30' : 'badge-success'}`}
                >
                  {selected.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              {/* Pagos del alumno */}
              <h4 className="font-headline font-bold text-sm uppercase tracking-widest mb-3">Pagos</h4>
              {pagosAlumno.length === 0 ? (
                <p className="text-on-surface-variant text-sm">Este estudiante no tiene pagos registrados.</p>
              ) : (
                <div className="space-y-3">
                  {pagosAlumno.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-variant">
                      <div className="flex-1">
                        <p className="font-bold text-sm">{p.concepto}</p>
                        <p className="text-xs text-on-surface-variant">${Number(p.monto).toLocaleString()} · {p.metodo_pago} · {new Date(p.created_at).toLocaleDateString('es')}</p>
                      </div>
                      {p.comprobante_url && (
                        <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-secondary hover:underline text-xs">Ver comprobante</a>
                      )}
                      {p.estado === 'pendiente' ? (
                        <button onClick={() => confirmarPago(p.id)} className="badge badge-secondary cursor-pointer hover:bg-secondary/30">Confirmar</button>
                      ) : (
                        <span className={`badge ${p.estado === 'confirmado' ? 'badge-success' : 'badge-error'}`}>{p.estado}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Alta */}
      {showAltaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={darDeAlta} className="bg-surface-container w-full max-w-md rounded-2xl p-6 space-y-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">Dar de Alta Alumno</h3>
              <button type="button" onClick={() => setShowAltaModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {altaStatus === 'success' ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-secondary text-4xl">check_circle</span>
                <p className="font-bold mt-2">Alumno creado. Recibirá un email de confirmación.</p>
              </div>
            ) : (
              <>
                {[
                  { id: 'nombre', label: 'Nombre', type: 'text', placeholder: 'María' },
                  { id: 'apellido', label: 'Apellido', type: 'text', placeholder: 'López' },
                  { id: 'email', label: 'Email', type: 'email', placeholder: 'maria@email.com' },
                  { id: 'telefono', label: 'Teléfono / WhatsApp', type: 'tel', placeholder: '+57 300...' },
                ].map(f => (
                  <div key={f.id}>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">{f.label}</label>
                    <input required type={f.type} value={altaForm[f.id]} onChange={e => setAltaForm(p => ({ ...p, [f.id]: e.target.value }))} className="input-field" placeholder={f.placeholder} />
                  </div>
                ))}
                <p className="text-xs text-on-surface-variant">Se enviará un email al alumno para que establezca su contraseña.</p>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAltaModal(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" disabled={altaStatus === 'loading'} className="btn-primary flex-1">
                    {altaStatus === 'loading' ? 'Creando...' : 'Crear Alumno'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
