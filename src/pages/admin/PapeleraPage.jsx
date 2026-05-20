import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { registrarAuditoria } from '../../utils/auditoria';

const SUPER_ADMIN = 'ing.lp.tech@gmail.com';

const TABS = [
  { key: 'auditoria',    label: 'Auditoría',   icon: 'history',                 tabla: 'auditoria' },
  { key: 'estudiantes',  label: 'Estudiantes',  icon: 'school',                  tabla: 'perfiles' },
  { key: 'recursos',     label: 'Recursos',     icon: 'video_library',           tabla: 'recursos' },
  { key: 'cupones',      label: 'Cupones',      icon: 'confirmation_number',     tabla: 'cupones' },
  { key: 'movimientos',  label: 'Finanzas',     icon: 'account_balance_wallet',  tabla: 'finanzas_movimientos' },
  { key: 'notas',        label: 'Notas',        icon: 'sticky_note_2',           tabla: 'finanzas_notas' },
  { key: 'calculos',     label: 'Cálculos',     icon: 'calculate',               tabla: 'costos_alumnos' },
];

const ACCION_STYLE = {
  eliminacion:  { color: 'text-error',     bg: 'bg-error/10',     icon: 'delete',         label: 'Eliminado' },
  modificacion: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: 'edit',           label: 'Modificado' },
  restauracion: { color: 'text-green-400', bg: 'bg-green-400/10', icon: 'restore',        label: 'Restaurado' },
  creacion:     { color: 'text-primary',   bg: 'bg-primary/10',   icon: 'add_circle',     label: 'Creado' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMonto(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-AR')}`;
}

// ── Descripción legible por tipo de registro ──────────────────────────────────
function describeItem(tab, item) {
  switch (tab) {
    case 'estudiantes':
      return `${item.nombre || ''} ${item.apellido || ''} — ${item.email || ''} (${item.cursada || 'sin cursada'})`;
    case 'recursos':
      return `[${(item.tipo || '').toUpperCase()}] ${item.titulo || ''} — Módulo ${item.modulo || 'General'}`;
    case 'cupones':
      return `${item.code || ''} — ${item.type === 'percentage' ? `${item.value}% OFF` : fmtMonto(item.value) + ' OFF'}`;
    case 'movimientos':
      return `${item.tipo === 'ingreso' ? '↑' : '↓'} ${item.categoria || ''}: ${item.descripcion || ''} ${fmtMonto(item.monto)}`;
    case 'notas':
      return `${item.fecha || ''} · ${item.autor || ''}: ${(item.texto || '').slice(0, 80)}${item.texto?.length > 80 ? '…' : ''}`;
    case 'calculos':
      return `${item.nombre_proyecto || 'Sin nombre'} — Costo: ${fmtMonto(item.costo_total)} — Precio: ${fmtMonto(item.precio_venta)}`;
    default:
      return JSON.stringify(item).slice(0, 100);
  }
}

// ── Fila de la papelera ───────────────────────────────────────────────────────
function FilaPapelera({ tab, item, onRestaurar, restaurando }) {
  const [expandido, setExpandido] = useState(false);
  const esActivo = restaurando === item.id;

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="material-symbols-outlined text-error text-lg mt-0.5 shrink-0">delete</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium break-words">{describeItem(tab, item)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-on-surface-variant">
            <span>Eliminado: <span className="text-on-surface">{fmtDate(item.eliminado_en)}</span></span>
            {item.eliminado_por_email && (
              <span>Por: <span className="text-on-surface">{item.eliminado_por_email}</span></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpandido(v => !v)}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors"
            title="Ver datos completos"
          >
            <span className="material-symbols-outlined text-base">
              {expandido ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          <button
            onClick={() => onRestaurar(tab, item.id)}
            disabled={esActivo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {esActivo
              ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
              : <span className="material-symbols-outlined text-sm">restore</span>
            }
            {esActivo ? 'Restaurando…' : 'Restaurar'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-outline-variant/20 bg-surface-variant/30 p-4">
          <pre className="text-xs text-on-surface-variant overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {JSON.stringify(item, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Fila de auditoría ─────────────────────────────────────────────────────────
function FilaAuditoria({ item }) {
  const [expandido, setExpandido] = useState(false);
  const style = ACCION_STYLE[item.accion] || ACCION_STYLE.modificacion;

  return (
    <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${style.color}`}>
          {style.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${style.color} ${style.bg}`}>
              {style.label}
            </span>
            <span className="text-xs text-on-surface-variant">
              en <span className="text-on-surface font-medium">{item.tabla_origen}</span>
            </span>
          </div>
          {item.descripcion && (
            <p className="text-sm mt-1 break-words">{item.descripcion}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-on-surface-variant">
            <span>{fmtDate(item.created_at)}</span>
            {item.realizado_por_email && (
              <span>Por: <span className="text-on-surface">{item.realizado_por_email}</span></span>
            )}
          </div>
        </div>
        {(item.datos_anteriores || item.datos_nuevos) && (
          <button
            onClick={() => setExpandido(v => !v)}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors shrink-0"
            title="Ver detalles"
          >
            <span className="material-symbols-outlined text-base">
              {expandido ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        )}
      </div>

      {expandido && (
        <div className="border-t border-outline-variant/20 bg-surface-variant/30 p-4 grid md:grid-cols-2 gap-4">
          {item.datos_anteriores && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase mb-2">Datos anteriores</p>
              <pre className="text-xs text-on-surface-variant overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(item.datos_anteriores, null, 2)}
              </pre>
            </div>
          )}
          {item.datos_nuevos && (
            <div>
              <p className="text-xs font-bold text-on-surface-variant uppercase mb-2">Datos nuevos</p>
              <pre className="text-xs text-on-surface-variant overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {JSON.stringify(item.datos_nuevos, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PapeleraPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab]       = useState('auditoria');
  const [items, setItems]               = useState([]);
  const [cargando, setCargando]         = useState(false);
  const [restaurando, setRestaurando]   = useState(null);
  const [msgOk, setMsgOk]              = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
      </div>
    );
  }

  if (user?.email?.toLowerCase() !== SUPER_ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  const cargarTab = useCallback(async (tab) => {
    setCargando(true);
    setItems([]);
    try {
      if (tab === 'auditoria') {
        const { data } = await supabase
          .from('auditoria')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300);
        setItems(data || []);
      } else {
        const tabConfig = TABS.find(t => t.key === tab);
        const { data } = await supabase
          .from(tabConfig.tabla)
          .select('*')
          .not('eliminado_en', 'is', null)
          .order('eliminado_en', { ascending: false });
        setItems(data || []);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTab(activeTab);
  }, [activeTab, cargarTab]);

  async function restaurar(tab, id) {
    if (!confirm('¿Restaurar este registro?')) return;
    setRestaurando(id);
    try {
      const tabConfig = TABS.find(t => t.key === tab);
      if (!tabConfig || tab === 'auditoria') return;

      const extraUpdates = tab === 'estudiantes' ? { activo: true } : {};

      const { error } = await supabase.from(tabConfig.tabla).update({
        eliminado_en:        null,
        eliminado_por:       null,
        eliminado_por_email: null,
        ...extraUpdates,
      }).eq('id', id);

      if (error) throw error;

      const item = items.find(i => i.id === id);
      await registrarAuditoria({
        tabla:      tabConfig.tabla,
        registroId: id,
        accion:     'restauracion',
        descripcion: `Registro restaurado desde papelera (${tab})`,
        datosAnteriores: item,
      });

      setItems(prev => prev.filter(i => i.id !== id));
      setMsgOk('Registro restaurado correctamente');
      setTimeout(() => setMsgOk(''), 3000);
    } catch (e) {
      alert('Error al restaurar: ' + e.message);
    } finally {
      setRestaurando(null);
    }
  }

  const tabActual = TABS.find(t => t.key === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-error text-2xl">delete_sweep</span>
          Papelera & Auditoría
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Solo visible para <span className="text-primary font-bold">{SUPER_ADMIN}</span>.
          Los registros eliminados pueden recuperarse. La auditoría registra todas las acciones.
        </p>
      </div>

      {/* Toast de éxito */}
      {msgOk && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-400/15 border border-green-400/30 text-green-400 text-sm font-medium">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {msgOk}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-outline-variant/20 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-lg transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div>
        {/* Encabezado del tab */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${activeTab === 'auditoria' ? 'text-primary' : 'text-error'}`}>
              {tabActual?.icon}
            </span>
            <span className="font-headline font-bold text-sm uppercase tracking-widest">
              {tabActual?.label}
              {!cargando && (
                <span className="ml-2 text-on-surface-variant font-normal normal-case">
                  ({items.length} {activeTab === 'auditoria' ? 'registros' : 'eliminados'})
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => cargarTab(activeTab)}
            disabled={cargando}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-variant transition-all disabled:opacity-50"
            title="Actualizar"
          >
            <span className={`material-symbols-outlined text-base ${cargando ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>

        {cargando && (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">refresh</span>
          </div>
        )}

        {!cargando && items.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">
              {activeTab === 'auditoria' ? 'history' : 'delete_sweep'}
            </span>
            <p className="text-on-surface-variant mt-3 text-sm">
              {activeTab === 'auditoria'
                ? 'No hay registros de auditoría todavía'
                : 'La papelera está vacía para esta categoría'}
            </p>
          </div>
        )}

        {!cargando && items.length > 0 && (
          <div className="space-y-2">
            {activeTab === 'auditoria'
              ? items.map(item => <FilaAuditoria key={item.id} item={item} />)
              : items.map(item => (
                  <FilaPapelera
                    key={item.id}
                    tab={activeTab}
                    item={item}
                    onRestaurar={restaurar}
                    restaurando={restaurando}
                  />
                ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
