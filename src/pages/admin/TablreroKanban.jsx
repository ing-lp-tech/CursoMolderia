import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'da_kanban_v1';
const PRIORIDAD_COLOR = {
  baja: 'bg-outline/20 text-on-surface-variant',
  normal: 'bg-primary/20 text-primary',
  alta: 'bg-secondary/20 text-secondary',
  urgente: 'bg-error/20 text-error',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_COLUMNS = [
  { id: uid(), titulo: 'Por Hacer', color: '#b89fff' },
  { id: uid(), titulo: 'En Proceso', color: '#00e3fd' },
  { id: uid(), titulo: 'Revisión', color: '#ff51fa' },
  { id: uid(), titulo: 'Completado', color: '#22d3a0' },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { columns: DEFAULT_COLUMNS, tasks: [] };
}

function saveState(columns, tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns, tasks }));
}

// ── Task Card ──────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onDragStart, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all group shadow-sm"
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="font-bold text-sm leading-snug flex-1">{task.titulo}</p>
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEdit(task)} className="text-on-surface-variant hover:text-primary p-0.5 rounded transition-colors">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onDelete(task.id)} className="text-on-surface-variant hover:text-error p-0.5 rounded transition-colors">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      {task.descripcion && (
        <p className="text-xs text-on-surface-variant mb-2 line-clamp-2">{task.descripcion}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[task.prioridad]}`}>
          {task.prioridad}
        </span>
        {task.etiqueta && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-tertiary/20 text-tertiary">
            {task.etiqueta}
          </span>
        )}
        {task.fecha_limite && (
          <span className="text-[9px] font-bold text-on-surface-variant flex items-center gap-0.5 ml-auto">
            <span className="material-symbols-outlined text-[11px]">calendar_today</span>
            {new Date(task.fecha_limite + 'T00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Column ──────────────────────────────────────────────────────────────────
function Column({ col, tasks, onAddTask, onEditCol, onDeleteCol, onEditTask, onDeleteTask, onDragStart, onDragEnd, onDrop }) {
  const [isOver, setIsOver] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (addingTask) inputRef.current?.focus();
  }, [addingTask]);

  function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickTitle.trim()) { setAddingTask(false); return; }
    onAddTask(col.id, { titulo: quickTitle.trim() });
    setQuickTitle('');
    setAddingTask(false);
  }

  return (
    <div
      className={`flex flex-col rounded-xl min-h-[200px] transition-colors w-full ${isOver ? 'bg-surface-container-high' : 'bg-surface-container'}`}
      style={{ minWidth: 0 }}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={() => { setIsOver(false); onDrop(col.id); }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-outline-variant/20">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col.color }} />
        <h3 className="font-headline font-bold text-sm flex-1 truncate">{col.titulo}</h3>
        <span className="text-[10px] font-bold text-on-surface-variant bg-surface-variant px-1.5 py-0.5 rounded-full">{tasks.length}</span>
        <button onClick={() => onEditCol(col)} className="text-on-surface-variant hover:text-on-surface p-0.5 rounded transition-colors">
          <span className="material-symbols-outlined text-base">more_horiz</span>
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {isOver && (
          <div className="h-16 border-2 border-dashed border-primary/40 rounded-xl bg-primary/5" />
        )}
      </div>

      {/* Quick add */}
      <div className="p-2 border-t border-outline-variant/10">
        {addingTask ? (
          <form onSubmit={handleQuickAdd} className="space-y-2">
            <input
              ref={inputRef}
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setAddingTask(false)}
              placeholder="Título de la tarea..."
              className="input-field text-sm py-2"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary py-1 px-3 text-xs flex-1">Agregar</button>
              <button type="button" onClick={() => setAddingTask(false)} className="btn-secondary py-1 px-3 text-xs">✕</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface w-full p-2 rounded-lg hover:bg-surface-variant transition-all text-xs font-bold uppercase tracking-wide"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Agregar tarea
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Board ──────────────────────────────────────────────────────────────
export default function TablreroKanban() {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [mobileColIdx, setMobileColIdx] = useState(0);
  const [taskModal, setTaskModal] = useState(null);
  const [colModal, setColModal] = useState(null);
  const [isNewCol, setIsNewCol] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const { columns: c, tasks: t } = loadState();
    setColumns(c);
    setTasks(t);
  }, []);

  // Save on change
  useEffect(() => {
    if (columns.length > 0 || tasks.length > 0) saveState(columns, tasks);
  }, [columns, tasks]);

  // ── Tasks CRUD ──────────────────────────────────────────────
  function addTask(colId, partial) {
    const task = {
      id: uid(),
      columna_id: colId,
      titulo: partial.titulo || 'Nueva tarea',
      descripcion: '',
      prioridad: 'normal',
      etiqueta: '',
      fecha_limite: '',
    };
    setTasks(prev => [...prev, task]);
  }

  function saveTask(task) {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    setTaskModal(null);
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setTaskModal(null);
  }

  // ── Columns CRUD ────────────────────────────────────────────
  function openNewCol() {
    setIsNewCol(true);
    setColModal({ id: uid(), titulo: '', color: '#b89fff' });
  }

  function saveCol(col) {
    if (!col.titulo.trim()) return;
    if (isNewCol) {
      setColumns(prev => [...prev, { ...col, titulo: col.titulo.trim() }]);
    } else {
      setColumns(prev => prev.map(c => c.id === col.id ? { ...col, titulo: col.titulo.trim() } : c));
    }
    setColModal(null);
    setIsNewCol(false);
  }

  function deleteCol(colId) {
    setColumns(prev => prev.filter(c => c.id !== colId));
    setTasks(prev => prev.filter(t => t.columna_id !== colId));
    setColModal(null);
    setIsNewCol(false);
  }

  // ── Drag & Drop ─────────────────────────────────────────────
  function handleDrop(colId) {
    if (!dragging) return;
    setTasks(prev => prev.map(t => t.id === dragging.id ? { ...t, columna_id: colId } : t));
    setDragging(null);
  }

  const COLORS = ['#b89fff', '#00e3fd', '#ff51fa', '#f59e0b', '#22d3a0', '#f87171', '#60a5fa', '#a3e635'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="font-headline text-2xl font-bold">Tablero de Tareas</h2>
          <p className="text-on-surface-variant text-sm">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''} · {columns.length} columna{columns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewCol} className="btn-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">view_column</span>
            Nueva Columna
          </button>
        </div>
      </div>

      {/* Board */}
      {columns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl">view_kanban</span>
          <p className="font-headline text-xl font-bold">Tu tablero está vacío</p>
          <p className="text-sm">Creá tu primera columna para empezar a organizar tus tareas.</p>
          <button onClick={openNewCol} className="btn-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            Crear primera columna
          </button>
        </div>
      ) : (
        <>
          {/* ── Mobile: tab column switcher ── */}
          <div className="md:hidden mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {columns.map((col, idx) => (
                <button
                  key={col.id}
                  onClick={() => setMobileColIdx(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                    mobileColIdx === idx
                      ? 'text-black'
                      : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  style={mobileColIdx === idx ? { background: col.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: mobileColIdx === idx ? 'rgba(0,0,0,0.3)' : col.color }} />
                  {col.titulo}
                  <span className="bg-black/20 px-1 rounded-full">{tasks.filter(t => t.columna_id === col.id).length}</span>
                </button>
              ))}
            </div>
            {/* Mobile: navigation arrows + add column */}
            <div className="flex items-center gap-2 mt-2">
              <button disabled={mobileColIdx === 0} onClick={() => setMobileColIdx(i => i - 1)} className="p-1.5 rounded-lg bg-surface-variant disabled:opacity-30 text-on-surface-variant">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="text-xs text-on-surface-variant">{mobileColIdx + 1} / {columns.length}</span>
              <button disabled={mobileColIdx === columns.length - 1} onClick={() => setMobileColIdx(i => i + 1)} className="p-1.5 rounded-lg bg-surface-variant disabled:opacity-30 text-on-surface-variant">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
              <button onClick={openNewCol} className="ml-auto text-xs text-primary font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">add</span>Nueva col.
              </button>
            </div>
          </div>

          {/* ── Mobile: single column view ── */}
          <div className="md:hidden flex-1">
            {columns[mobileColIdx] && (
              <Column
                col={columns[mobileColIdx]}
                tasks={tasks.filter(t => t.columna_id === columns[mobileColIdx].id)}
                onAddTask={addTask}
                onEditCol={c => { setIsNewCol(false); setColModal(c); }}
                onDeleteCol={deleteCol}
                onEditTask={t => setTaskModal({ ...t })}
                onDeleteTask={deleteTask}
                onDragStart={t => setDragging(t)}
                onDragEnd={() => {}}
                onDrop={handleDrop}
              />
            )}
          </div>

          {/* ── Desktop: all columns horizontal ── */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
            {columns.map(col => (
              <div key={col.id} style={{ minWidth: 260, maxWidth: 300, flexShrink: 0, width: 280 }}>
                <Column
                  col={col}
                  tasks={tasks.filter(t => t.columna_id === col.id)}
                  onAddTask={addTask}
                  onEditCol={c => { setIsNewCol(false); setColModal(c); }}
                  onDeleteCol={deleteCol}
                  onEditTask={t => setTaskModal({ ...t })}
                  onDeleteTask={deleteTask}
                  onDragStart={t => setDragging(t)}
                  onDragEnd={() => {}}
                  onDrop={handleDrop}
                />
              </div>
            ))}
            <button
              onClick={openNewCol}
              className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container transition-all text-on-surface-variant hover:text-primary p-6 h-24"
              style={{ minWidth: 200 }}
            >
              <span className="material-symbols-outlined">add</span>
              <span className="text-xs font-bold uppercase tracking-wide">Nueva columna</span>
            </button>
          </div>
        </>
      )}

      {/* ── TASK MODAL ── */}
      {taskModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setTaskModal(null)}>
          <div className="bg-surface-container w-full max-w-md rounded-2xl border border-outline-variant/30 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h3 className="font-headline font-bold">Editar Tarea</h3>
              <div className="flex gap-2">
                <button onClick={() => { if (confirm('¿Eliminar esta tarea?')) deleteTask(taskModal.id); }} className="text-on-surface-variant hover:text-error transition-colors p-1">
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
                <button onClick={() => setTaskModal(null)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Título</label>
                <input
                  required
                  value={taskModal.titulo}
                  onChange={e => setTaskModal(p => ({ ...p, titulo: e.target.value }))}
                  className="input-field"
                  placeholder="Título de la tarea"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={taskModal.descripcion}
                  onChange={e => setTaskModal(p => ({ ...p, descripcion: e.target.value }))}
                  className="input-field resize-none"
                  placeholder="Detalles de la tarea..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Columna</label>
                  <select value={taskModal.columna_id} onChange={e => setTaskModal(p => ({ ...p, columna_id: e.target.value }))} className="input-field">
                    {columns.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Prioridad</label>
                  <select value={taskModal.prioridad} onChange={e => setTaskModal(p => ({ ...p, prioridad: e.target.value }))} className="input-field">
                    {['baja', 'normal', 'alta', 'urgente'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Etiqueta</label>
                  <input
                    value={taskModal.etiqueta || ''}
                    onChange={e => setTaskModal(p => ({ ...p, etiqueta: e.target.value }))}
                    className="input-field"
                    placeholder="ej: pago, alumno"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Fecha límite</label>
                  <input type="date" value={taskModal.fecha_limite || ''} onChange={e => setTaskModal(p => ({ ...p, fecha_limite: e.target.value }))} className="input-field" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setTaskModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveTask(taskModal)} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COLUMN MODAL ── */}
      {colModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setColModal(null)}>
          <div className="bg-surface-container w-full max-w-sm rounded-2xl border border-outline-variant/30 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h3 className="font-headline font-bold">{isNewCol ? 'Nueva Columna' : 'Editar Columna'}</h3>
              <button onClick={() => setColModal(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre</label>
                <input
                  autoFocus
                  value={colModal.titulo}
                  onChange={e => setColModal(p => ({ ...p, titulo: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveCol(colModal)}
                  className="input-field"
                  placeholder="ej: En Revisión"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColModal(p => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${colModal.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-container scale-110' : 'hover:scale-110'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              {!isNewCol && (
                <button onClick={() => { if (confirm('¿Eliminar columna y sus tareas?')) deleteCol(colModal.id); }} className="text-error hover:bg-error/10 px-3 py-2 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              )}
              <button onClick={() => { setColModal(null); setIsNewCol(false); }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => saveCol(colModal)} className="btn-primary flex-1">
                {isNewCol ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
