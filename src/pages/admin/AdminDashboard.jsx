import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ estudiantes: 0, pagos_pendientes: 0, ingresos: 0, tareas: 0, con_descuento: 0, ahorro_total: 0 });
  const [pagos_recientes, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [{ count: est }, { count: pend }, { data: pagos }, { data: fin }, { count: tareas }, { data: pagosDesc }] = await Promise.all([
          supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'estudiante'),
          supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
          supabase.from('pagos').select('*, perfiles(nombre, apellido)').order('created_at', { ascending: false }).limit(5),
          supabase.from('finanzas').select('monto, tipo'),
          supabase.from('tareas').select('*', { count: 'exact', head: true }),
          supabase.from('pagos').select('descuento_aplicado').not('cupon_codigo', 'is', null),
        ]);

        const ingresos = fin?.filter(f => f.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0) || 0;
        const con_descuento = pagosDesc?.length || 0;
        const ahorro_total = pagosDesc?.reduce((sum, p) => sum + (Number(p.descuento_aplicado) || 0), 0) || 0;
        setStats({
          estudiantes: est || 0,
          pagos_pendientes: pend || 0,
          ingresos,
          tareas: tareas || 0,
          con_descuento,
          ahorro_total,
        });
        setPagos(pagos || []);

        // Load config separately so it doesn't break the whole dashboard if missing
        const { data: config } = await supabase.from('app_settings').select('value').eq('id', 'test_mode_mp').limit(1);
        if (config && config.length > 0 && config[0].value === true) {
          setTestMode(true);
        }
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleTestMode() {
    const newVal = !testMode;
    setTestMode(newVal);
    const { error } = await supabase.from('app_settings').upsert({ id: 'test_mode_mp', value: newVal });
    if (error) {
      console.error("Error guardando el botón:", error);
      alert("Error en Supabase al guardar la config: " + error.message);
      setTestMode(!newVal); // revert
    }
  }

  const STAT_CARDS = [
    { label: 'Estudiantes', value: stats.estudiantes, icon: 'school', color: 'text-primary', link: '/admin/estudiantes' },
    { label: 'Pagos Pendientes', value: stats.pagos_pendientes, icon: 'pending_actions', color: 'text-error', link: '/admin/estudiantes' },
    { label: 'Ingresos Totales', value: `$${stats.ingresos.toLocaleString()}`, icon: 'account_balance_wallet', color: 'text-secondary', link: '/admin/finanzas' },
    { label: 'Tareas Activas', value: stats.tareas, icon: 'view_kanban', color: 'text-tertiary', link: '/admin/tablero' },
    { label: 'Inscriptos c/ Descuento', value: stats.con_descuento, icon: 'local_offer', color: 'text-tertiary', link: '/admin/cupones' },
    { label: 'Ahorro Total Otorgado', value: `$${stats.ahorro_total.toLocaleString()}`, icon: 'savings', color: 'text-error', link: '/admin/cupones' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-2xl font-bold">Bienvenido al Panel Admin</h2>
          <p className="text-on-surface-variant text-sm mt-1">Todo el control de tu negocio en un solo lugar.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-surface-variant px-4 py-2 rounded-xl border border-outline-variant/20">
          <span className="material-symbols-outlined text-error">bug_report</span>
          <div className="text-sm">
            <p className="font-bold">Plan de Prueba ($100)</p>
            <p className="text-xs text-on-surface-variant">Habilitar en página de inscripción</p>
          </div>
          <button 
            onClick={toggleTestMode}
            className={`w-12 h-6 ml-2 rounded-full relative transition-colors duration-300 ${testMode ? 'bg-error' : 'bg-outline-variant/30'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${testMode ? 'translate-x-6' : 'translate-x-0'}`}></span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map(s => (
          <Link to={s.link} key={s.label} className="card-hover group">
            <div className="flex items-start justify-between mb-4">
              <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
              <span className="material-symbols-outlined text-outline-variant text-sm group-hover:text-on-surface-variant transition-colors">arrow_forward</span>
            </div>
            <p className="font-headline text-2xl font-black">{loading ? '—' : s.value}</p>
            <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Últimos Pagos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline font-bold uppercase tracking-wide text-sm">Últimos Pagos</h3>
          <Link to="/admin/estudiantes" className="text-xs text-primary hover:underline">Ver todos →</Link>
        </div>
        <div className="card overflow-x-auto border border-outline-variant/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {['Alumno', 'Concepto', 'Monto', 'Cupón', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant">Cargando...</td></tr>
              ) : pagos_recientes.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant">Aún no hay pagos registrados.</td></tr>
              ) : pagos_recientes.map(p => (
                <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-variant/30 transition-colors">
                  <td className="py-3 px-4 font-bold">{p.perfiles?.nombre} {p.perfiles?.apellido}</td>
                  <td className="py-3 px-4 text-on-surface-variant">{p.concepto}</td>
                  <td className="py-3 px-4 font-bold">
                    {p.descuento_aplicado > 0 ? (
                      <span>
                        <span className="line-through text-on-surface-variant text-xs">${Number(p.monto_original).toLocaleString()}</span>
                        {' '}
                        <span className="text-tertiary">${Number(p.monto).toLocaleString()}</span>
                      </span>
                    ) : `$${Number(p.monto).toLocaleString()}`}
                  </td>
                  <td className="py-3 px-4">
                    {p.cupon_codigo
                      ? <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-tertiary/20 text-tertiary">{p.cupon_codigo}</span>
                      : <span className="text-on-surface-variant text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${p.estado === 'confirmado' ? 'badge-success' : p.estado === 'rechazado' ? 'badge-error' : 'badge-outline'}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant">{new Date(p.created_at).toLocaleDateString('es')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
