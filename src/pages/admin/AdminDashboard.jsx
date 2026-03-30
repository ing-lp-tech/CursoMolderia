import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ estudiantes: 0, pagos_pendientes: 0, ingresos: 0, tareas: 0 });
  const [pagos_recientes, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: est }, { count: pend }, { data: pagos }, { data: fin }, { count: tareas }] = await Promise.all([
        supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'estudiante'),
        supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('pagos').select('*, perfiles(nombre, apellido)').order('created_at', { ascending: false }).limit(5),
        supabase.from('finanzas').select('monto, tipo'),
        supabase.from('tareas').select('*', { count: 'exact', head: true }),
      ]);
      const ingresos = fin?.filter(f => f.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0) || 0;
      setStats({ estudiantes: est || 0, pagos_pendientes: pend || 0, ingresos, tareas: tareas || 0 });
      setPagos(pagos || []);
      setLoading(false);
    }
    load();
  }, []);

  const STAT_CARDS = [
    { label: 'Estudiantes', value: stats.estudiantes, icon: 'school', color: 'text-primary', link: '/admin/estudiantes' },
    { label: 'Pagos Pendientes', value: stats.pagos_pendientes, icon: 'pending_actions', color: 'text-error', link: '/admin/estudiantes' },
    { label: 'Ingresos Totales', value: `$${stats.ingresos.toLocaleString()}`, icon: 'account_balance_wallet', color: 'text-secondary', link: '/admin/finanzas' },
    { label: 'Tareas Activas', value: stats.tareas, icon: 'view_kanban', color: 'text-tertiary', link: '/admin/tablero' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-2xl font-bold">Bienvenido al Panel Admin</h2>
        <p className="text-on-surface-variant text-sm mt-1">Todo el control de tu negocio en un solo lugar.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                {['Alumno', 'Concepto', 'Monto', 'Método', 'Estado', 'Fecha'].map(h => (
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
                  <td className="py-3 px-4 font-bold">${Number(p.monto).toLocaleString()}</td>
                  <td className="py-3 px-4 text-on-surface-variant capitalize">{p.metodo_pago}</td>
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
