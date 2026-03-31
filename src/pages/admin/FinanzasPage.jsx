import React, { useState, useEffect, useMemo, useRef } from 'react';

const STORAGE_KEY = 'da_finanzas_v1';

function uid() { return Math.random().toString(36).slice(2, 10); }

const CATEGORIAS = {
  ingreso: ['Matrícula', 'Cuota mensual', 'Transferencia alumno', 'Nequi', 'Daviplata', 'Efectivo', 'Otro ingreso'],
  egreso: ['Publicidad', 'Plataformas digitales', 'Material didáctico', 'Software / licencias', 'Equipamiento', 'Alquiler', 'Servicios (luz/internet)', 'Impuestos', 'Devolución', 'Otro egreso'],
  deuda: ['Proveedor', 'Préstamo', 'Cuota pendiente alumno', 'Servicio pendiente', 'Otro'],
};

const METODOS = ['Transferencia bancaria', 'Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'MercadoPago', 'Tarjeta', 'Otro'];

const TIPO_ICON = { ingreso: 'trending_up', egreso: 'trending_down', deuda: 'account_balance' };
const TIPO_COLOR = { ingreso: 'text-secondary', egreso: 'text-error', deuda: 'text-tertiary' };
const TIPO_BG = { ingreso: 'bg-secondary/10 border-secondary/30', egreso: 'bg-error/10 border-error/30', deuda: 'bg-tertiary/10 border-tertiary/30' };

const EMPTY_FORM = {
  tipo: 'ingreso', categoria: 'Matrícula', descripcion: '', monto: '',
  fecha: new Date().toISOString().slice(0, 10), metodo: 'Transferencia bancaria',
  notas: '', estado: 'confirmado', beneficiario: '', comprobantes: []
};

// ── IMAGE COMPRESSOR ──────────────────────────────────────────────────────────
async function compressImage(file, maxWidth = 800, maxQuality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', maxQuality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

function loadLocal() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveLocal(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function toCSV(rows) {
  const cols = ['fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'metodo', 'estado', 'notas'];
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(c => `"${(r[c] ?? '')}"`).join(','));
  return [header, ...lines].join('\n');
}

// ── Summary Card ──────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, colorClass, borderClass, sub }) {
  return (
    <div className={`card border ${borderClass} flex-1`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined ${colorClass}`}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <p className={`font-headline text-3xl font-black ${colorClass}`}>
        ${Math.abs(value).toLocaleString('es')}
      </p>
      {sub && <p className="text-xs text-on-surface-variant mt-1">{sub}</p>}
    </div>
  );
}

// ── Move Row ──────────────────────────────────────────────────────────────
function Row({ m, onEdit, onDelete }) {
  return (
    <tr className="border-b border-outline-variant/10 hover:bg-surface-variant/30 transition-colors group">
      <td className="py-3 px-4 text-on-surface-variant text-sm whitespace-nowrap">
        {new Date(m.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
          m.tipo === 'ingreso' ? 'bg-secondary/15 text-secondary' : m.tipo === 'egreso' ? 'bg-error/15 text-error' : 'bg-tertiary/15 text-tertiary'
        }`}>
          <span className="material-symbols-outlined text-[12px]">{TIPO_ICON[m.tipo]}</span>
          {m.tipo}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-on-surface-variant">{m.categoria}</td>
      <td className="py-3 px-4 text-sm font-medium max-w-[200px] truncate">
        {m.descripcion}
        {m.comprobantes && m.comprobantes.length > 0 && (
          <span title={`${m.comprobantes.length} adjunto(s)`} className="material-symbols-outlined text-[14px] text-primary align-middle ml-1">attachment</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-on-surface-variant">{m.metodo}</td>
      <td className="py-3 px-4">
        {m.tipo === 'deuda' ? (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${m.estado === 'pagado' ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'}`}>
            {m.estado}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">confirmado</span>
        )}
      </td>
      <td className={`py-3 px-4 font-black text-sm ${TIPO_COLOR[m.tipo]}`}>
        {m.tipo === 'egreso' ? '-' : '+'}${Number(m.monto).toLocaleString('es')}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(m)} className="text-on-surface-variant hover:text-primary p-1 rounded transition-colors">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onDelete(m.id)} className="text-on-surface-variant hover:text-error p-1 rounded transition-colors">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const isMountedRef = useRef(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [movimientos, setMovimientos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterMes, setFilterMes] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('movimientos'); // movimientos | deudas | resumen

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    isMountedRef.current = true;
    loadFromSupabase();
    return () => { isMountedRef.current = false; };
  }, []);

  async function loadFromSupabase() {
    setSyncStatus('syncing');
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_state?id=eq.1&select=data`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (!isMountedRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const dbData = rows[0]?.data;
      
      const localData = loadLocal();
      if (dbData && dbData.movimientos && dbData.movimientos.length > 0) {
         setMovimientos(dbData.movimientos);
         saveLocal(dbData.movimientos);
      } else if (localData.length > 0) {
         setMovimientos(localData);
         syncToSupabase(localData);
      } else {
         setMovimientos([]);
      }
      setSyncStatus('ok');
    } catch (e) {
      console.error('[Finanzas] Error fetch inicial', e);
      if (isMountedRef.current) {
         setSyncStatus('error');
         setMovimientos(loadLocal());
      }
    }
  }

  async function syncToSupabase(nextMovs) {
    if (!isMountedRef.current) return;
    setSyncStatus('syncing');
    try {
      saveLocal(nextMovs);
      const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_state?id=eq.1`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({ data: { movimientos: nextMovs } })
      });
      if (isMountedRef.current) setSyncStatus(res.ok ? 'ok' : 'error');
    } catch (e) {
      if (isMountedRef.current) setSyncStatus('error');
    }
  }

  function persist(next) {
    setMovimientos(next);
    syncToSupabase(next);
  }

  function openNew(tipo = 'ingreso') {
    setEditingId(null);
    setSelectedFiles([]);
    setForm({ ...EMPTY_FORM, tipo, categoria: CATEGORIAS[tipo][0] });
    setShowModal(true);
  }

  function openEdit(m) {
    setEditingId(m.id);
    setSelectedFiles([]);
    setForm({ ...m, comprobantes: m.comprobantes || [] });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.monto || !form.descripcion) return;
    
    // Check files
    if (selectedFiles.length + (form.comprobantes?.length || 0) > 3) {
       return alert('El máximo total de comprobantes es 3.');
    }

    setIsUploading(true);
    let finalComprobantes = [...(form.comprobantes || [])];

    // Upload selected files
    for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress(`Optimizando y subiendo ${i + 1} de ${selectedFiles.length}...`);
        try {
            const file = selectedFiles[i];
            const compressedBlob = await compressImage(file);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/comprobantes/${fileName}`, {
                method: 'POST',
                headers: {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    'Content-Type': 'image/jpeg'
                },
                body: compressedBlob
            });
            if (!uploadRes.ok) throw new Error('Falló subida al bucket');
            
            // Generate public URL using string replacement logic or standard public URL
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/comprobantes/${fileName}`;
            finalComprobantes.push(publicUrl);
        } catch(err) {
            console.error('Error subiendo imagen:', err);
            alert(`No se pudo subir la imagen adjunta ${i+1}. Es posible que no haya internet.`);
        }
    }

    if (!isMountedRef.current) return;
    setIsUploading(false);
    setUploadProgress('');
    
    const nextForm = { ...form, comprobantes: finalComprobantes };

    if (editingId) {
      persist(movimientos.map(m => m.id === editingId ? { ...nextForm, id: editingId } : m));
    } else {
      persist([{ ...nextForm, id: uid(), monto: Number(nextForm.monto) }, ...movimientos]);
    }
    setShowModal(false);
    setEditingId(null);
    setSelectedFiles([]);
  }

  function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    persist(movimientos.filter(m => m.id !== id));
  }

  function toggleDeudaEstado(id) {
    persist(movimientos.map(m => m.id === id ? { ...m, estado: m.estado === 'pagado' ? 'pendiente' : 'pagado' } : m));
  }

  // ── Derived stats ──
  const ingresos = useMemo(() => movimientos.filter(m => m.tipo === 'ingreso').reduce((a, b) => a + Number(b.monto), 0), [movimientos]);
  const egresos = useMemo(() => movimientos.filter(m => m.tipo === 'egreso').reduce((a, b) => a + Number(b.monto), 0), [movimientos]);
  const deudas = useMemo(() => movimientos.filter(m => m.tipo === 'deuda'), [movimientos]);
  const deudas_pendientes = useMemo(() => deudas.filter(d => d.estado !== 'pagado').reduce((a, b) => a + Number(b.monto), 0), [deudas]);
  const balance = ingresos - egresos;

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = movimientos;
    if (filterTipo !== 'todos') list = list.filter(m => m.tipo === filterTipo);
    if (filterMes) list = list.filter(m => m.fecha?.slice(0, 7) === filterMes);
    if (search) list = list.filter(m => [m.descripcion, m.categoria, m.notas, m.beneficiario].join(' ').toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientos, filterTipo, filterMes, search]);

  // ── Category breakdown for resumen ──
  const catBreakdown = useMemo(() => {
    const map = {};
    movimientos.filter(m => m.tipo === 'egreso').forEach(m => {
      map[m.categoria] = (map[m.categoria] || 0) + Number(m.monto);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [movimientos]);

  const meses = useMemo(() => {
    const s = new Set(movimientos.map(m => m.fecha?.slice(0, 7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [movimientos]);

  function exportCSV() {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finanzas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-headline text-2xl font-bold">Finanzas</h2>
            <p className="text-on-surface-variant text-sm flex items-center gap-1.5">
              Ingresos, egresos y deudas de tu negocio
              {syncStatus !== 'idle' && (
                <span title={syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'error' ? 'Error al guardar. Datos solo en memoria local.' : 'Datos a salvo en la nube'} className={`material-symbols-outlined text-[14px] ${syncStatus === 'syncing' ? 'text-primary animate-pulse' : syncStatus === 'error' ? 'text-error animate-bounce' : 'text-green-500'}`}>
                  {syncStatus === 'syncing' ? 'cloud_sync' : syncStatus === 'error' ? 'cloud_off' : 'cloud_done'}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar CSV
          </button>
          <button onClick={() => openNew('egreso')} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <span className="material-symbols-outlined text-sm">trending_down</span>
            Gasto
          </button>
          <button onClick={() => openNew('deuda')} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 border-tertiary/40 text-tertiary">
            <span className="material-symbols-outlined text-sm">account_balance</span>
            Deuda
          </button>
          <button onClick={() => openNew('ingreso')} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">add</span>
            Ingreso
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-4">
        <SummaryCard label="Ingresos" value={ingresos} icon="trending_up" colorClass="text-secondary" borderClass="border-secondary/30" sub="Total acumulado" />
        <SummaryCard label="Egresos" value={egresos} icon="trending_down" colorClass="text-error" borderClass="border-error/30" sub="Gastos totales" />
        <SummaryCard label={balance >= 0 ? 'Ganancia' : 'Pérdida'} value={balance} icon="account_balance_wallet" colorClass={balance >= 0 ? 'text-primary' : 'text-error'} borderClass={balance >= 0 ? 'border-primary/30' : 'border-error/30'} sub="Ingresos − Egresos" />
        <SummaryCard label="Deudas Pendientes" value={deudas_pendientes} icon="account_balance" colorClass="text-tertiary" borderClass="border-tertiary/30" sub={`${deudas.filter(d => d.estado !== 'pagado').length} deuda(s)`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-outline-variant/20">
        {[['movimientos', 'Movimientos'], ['deudas', 'Deudas'], ['resumen', 'Resumen']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setActiveTab(val)}
            className={`px-5 py-2.5 font-headline text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${activeTab === val ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'}`}
          >
            {label}
            {val === 'deudas' && deudas.filter(d => d.estado !== 'pagado').length > 0 && (
              <span className="ml-1.5 bg-tertiary/20 text-tertiary text-[9px] px-1.5 py-0.5 rounded-full font-black">
                {deudas.filter(d => d.estado !== 'pagado').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Movimientos ── */}
      {activeTab === 'movimientos' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="input-field py-2 text-sm max-w-[200px]"
            />
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input-field py-2 text-sm max-w-[140px]">
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
              <option value="deuda">Deudas</option>
            </select>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="input-field py-2 text-sm max-w-[160px]">
              <option value="">Todos los meses</option>
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(filterTipo !== 'todos' || filterMes || search) && (
              <button onClick={() => { setFilterTipo('todos'); setFilterMes(''); setSearch(''); }} className="text-xs text-primary hover:underline font-bold">
                Limpiar filtros
              </button>
            )}
            <span className="text-xs text-on-surface-variant self-center ml-auto">{filtered.length} registros</span>
          </div>

          <div className="card border border-outline-variant/20 overflow-x-auto p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-3">receipt_long</span>
                <p className="font-bold">No hay movimientos aún.</p>
                <p className="text-sm mt-1">Agregá un ingreso, gasto o deuda para empezar.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método', 'Estado', 'Monto', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <Row key={m.id} m={m} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Deudas ── */}
      {activeTab === 'deudas' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-on-surface-variant text-sm">{deudas.filter(d => d.estado !== 'pagado').length} deuda(s) pendiente(s)</p>
            <button onClick={() => openNew('deuda')} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva deuda
            </button>
          </div>

          {deudas.length === 0 ? (
            <div className="card border border-outline-variant/20 py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl block mb-3">account_balance</span>
              <p className="font-bold">No hay deudas registradas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deudas.sort((a, b) => a.estado === 'pagado' ? 1 : -1).map(d => (
                <div key={d.id} className={`card border flex items-center gap-4 ${d.estado === 'pagado' ? 'border-outline-variant/10 opacity-50' : 'border-tertiary/20'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold truncate">{d.descripcion}</span>
                      {d.comprobantes && d.comprobantes.length > 0 && (
                        <span title={`${d.comprobantes.length} adjuntos`} className="material-symbols-outlined text-[14px] text-primary shrink-0">attachment</span>
                      )}
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${d.estado === 'pagado' ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary'}`}>
                        {d.estado === 'pagado' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
                      <span>{d.categoria}</span>
                      {d.beneficiario && <span>→ {d.beneficiario}</span>}
                      <span>{new Date(d.fecha + 'T12:00').toLocaleDateString('es')}</span>
                      {d.notas && <span className="italic">{d.notas}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-headline font-black text-xl text-tertiary">${Number(d.monto).toLocaleString('es')}</p>
                    <p className="text-xs text-on-surface-variant">{d.metodo}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => toggleDeudaEstado(d.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${d.estado === 'pagado' ? 'bg-outline/20 hover:bg-outline/30 text-on-surface-variant' : 'bg-secondary/20 hover:bg-secondary/30 text-secondary'}`}
                    >
                      {d.estado === 'pagado' ? 'Reabrir' : '✓ Marcar pagada'}
                    </button>
                    <button onClick={() => openEdit(d)} className="text-[10px] text-on-surface-variant hover:text-primary text-center">editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Resumen ── */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          {/* Monthly breakdown */}
          <div className="card border border-outline-variant/20">
            <h3 className="font-headline font-bold mb-4 uppercase text-xs tracking-widest text-on-surface-variant">Ingresos por mes</h3>
            {meses.length === 0 ? <p className="text-on-surface-variant text-sm">Sin datos</p> : (
              <div className="space-y-3">
                {meses.slice(0, 6).map(mes => {
                  const mesIng = movimientos.filter(m => m.tipo === 'ingreso' && m.fecha?.slice(0, 7) === mes).reduce((a, b) => a + Number(b.monto), 0);
                  const mesEgr = movimientos.filter(m => m.tipo === 'egreso' && m.fecha?.slice(0, 7) === mes).reduce((a, b) => a + Number(b.monto), 0);
                  const maxVal = Math.max(ingresos, 1);
                  return (
                    <div key={mes}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{mes}</span>
                        <span className="text-secondary">+${mesIng.toLocaleString('es')}</span>
                        <span className="text-error">-${mesEgr.toLocaleString('es')}</span>
                      </div>
                      <div className="h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary/60 rounded-full" style={{ width: `${(mesIng / maxVal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expenses by category */}
          <div className="card border border-outline-variant/20">
            <h3 className="font-headline font-bold mb-4 uppercase text-xs tracking-widest text-on-surface-variant">Egresos por categoría</h3>
            {catBreakdown.length === 0 ? <p className="text-on-surface-variant text-sm">Sin egresos</p> : (
              <div className="space-y-3">
                {catBreakdown.map(([cat, val]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold">{cat}</span>
                      <span className="text-error">${val.toLocaleString('es')}</span>
                    </div>
                    <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                      <div className="h-full bg-error/50 rounded-full" style={{ width: `${(val / egresos) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <form onSubmit={handleSave} className="bg-surface-container w-full max-w-lg rounded-2xl border border-outline-variant/30 overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface-container z-10">
              <h3 className="font-headline font-bold text-lg">
                {editingId ? 'Editar' : 'Nuevo'} {form.tipo === 'ingreso' ? 'Ingreso' : form.tipo === 'egreso' ? 'Gasto' : 'Deuda'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo (solo si es nuevo) */}
              {!editingId && (
                <div className="flex gap-2">
                  {[['ingreso', 'Ingreso', 'trending_up'], ['egreso', 'Gasto', 'trending_down'], ['deuda', 'Deuda', 'account_balance']].map(([val, lbl, icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: val, categoria: CATEGORIAS[val][0] }))}
                      className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-xs font-bold uppercase tracking-wide ${form.tipo === val ? TIPO_BG[val] + ' border-2' : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}
                    >
                      <span className={`material-symbols-outlined text-xl ${form.tipo === val ? TIPO_COLOR[val] : ''}`}>{icon}</span>
                      {lbl}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-field">
                    {CATEGORIAS[form.tipo].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Fecha</label>
                  <input required type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className="input-field" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción *</label>
                <input required value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" placeholder="ej: Matrícula de Ana García" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Monto (COP) *</label>
                  <input required type="number" min="0" step="100" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className="input-field" placeholder="400000" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Método de pago</label>
                  <select value={form.metodo} onChange={e => setForm(p => ({ ...p, metodo: e.target.value }))} className="input-field">
                    {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {form.tipo === 'deuda' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Acreedor / Proveedor</label>
                    <input value={form.beneficiario || ''} onChange={e => setForm(p => ({ ...p, beneficiario: e.target.value }))} className="input-field" placeholder="A quién se le debe" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Estado</label>
                    <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="input-field">
                      <option value="pendiente">Pendiente</option>
                      <option value="pagado">Pagada</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Notas (opcional)</label>
                <textarea rows={2} value={form.notas || ''} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className="input-field resize-none" placeholder="Observaciones adicionales..." />
              </div>

              {/* Comprobantes adjuntos */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  Archivos adjuntos ({(form.comprobantes?.length || 0) + selectedFiles.length} / 3)
                </label>
                
                <div className="flex flex-wrap gap-2 mb-2">
                  {/* Ya subidos */}
                  {(form.comprobantes || []).map((url, idx) => (
                    <div key={'c_'+idx} className="relative group w-16 h-16 rounded overflow-hidden border border-outline-variant/30">
                       <img src={url} className="w-full h-full object-cover" alt="comprobante" />
                       <a href={url} target="_blank" rel="noreferrer" className="absolute top-1 left-1 bg-black/60 text-white rounded p-0.5 text-[10px] z-10 hover:bg-black">ver</a>
                       <button type="button" onClick={() => setForm(p => ({...p, comprobantes: p.comprobantes.filter((_, i) => i !== idx)}))} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <span className="material-symbols-outlined text-sm">delete</span>
                       </button>
                    </div>
                  ))}
                  
                  {/* Seleccionados para subir */}
                  {selectedFiles.map((f, idx) => (
                     <div key={'n_'+idx} className="relative group w-16 h-16 rounded overflow-hidden border-2 border-primary/50 opacity-70">
                       <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="prev" />
                       <button type="button" disabled={isUploading} onClick={() => setSelectedFiles(p => p.filter((_, i) => i !== idx))} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <span className="material-symbols-outlined text-sm">close</span>
                       </button>
                       {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><span className="material-symbols-outlined animate-spin text-white">sync</span></div>}
                     </div>
                  ))}

                  {/* Botón agregar (si hay cupo) */}
                  {(form.comprobantes?.length || 0) + selectedFiles.length < 3 && !isUploading && (
                    <label className="w-16 h-16 rounded border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-colors bg-surface-variant/20">
                      <span className="material-symbols-outlined font-light">add_photo_alternate</span>
                      <input type="file" multiple accept="image/*" onChange={e => {
                        const files = Array.from(e.target.files);
                        if (files.length + selectedFiles.length + (form.comprobantes?.length || 0) > 3) return alert('Máximo 3 imágenes permitidas.');
                        setSelectedFiles(prev => [...prev, ...files]);
                        e.target.value = ''; // clean input
                      }} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-on-surface-variant">Se comprimirán de forma inteligente para ahorrar datos.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              {editingId && (
                <button type="button" disabled={isUploading} onClick={() => handleDelete(editingId)} className="text-error hover:bg-error/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
              <button type="button" disabled={isUploading} onClick={() => setShowModal(false)} className="btn-secondary flex-1 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isUploading} className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                {isUploading && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                {isUploading ? (uploadProgress || 'Guardando...') : editingId ? 'Guardar cambios' : `Registrar ${form.tipo}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
