import React, { useState, useEffect, useCallback } from 'react';
import {
  getSorteos,
  addSorteo,
  updateSorteo,
  deleteSorteo,
  ejecutarSorteo,
  publicarSorteo,
  despublicarSorteo,
  parsearParticipantes,
  generarRango,
  PREMIO_DEFAULT,
} from '../../utils/sorteos';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function periodoActual() {
  const txt = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

const emptyForm = () => ({
  titulo: '',
  premio: PREMIO_DEFAULT,
  periodo: periodoActual(),
  descripcion: '',
  cantidadGanadores: 1,
  modo: 'nombres',
  listaTexto: '',
  rangoDesde: 1,
  rangoHasta: 100,
});

function participantesDelForm(form) {
  return form.modo === 'nombres'
    ? parsearParticipantes(form.listaTexto)
    : generarRango(form.rangoDesde, form.rangoHasta);
}

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Modal de la ruleta ──────────────────────────────────────────────────────
function ModalSorteo({ sorteo, onCerrar, onEjecutar }) {
  const [fase, setFase] = useState(sorteo.estado === 'realizado' ? 'resultado' : 'confirmar');
  const [ganadores, setGanadores] = useState(sorteo.ganadores || []);
  const [muestra, setMuestra] = useState(sorteo.participantes[0] || '');
  const [errMsg, setErrMsg] = useState('');

  // Efecto visual de la ruleta girando (el sorteo real se hace con crypto)
  useEffect(() => {
    if (fase !== 'girando') return;
    const id = setInterval(() => {
      const i = Math.floor(Math.random() * sorteo.participantes.length);
      setMuestra(sorteo.participantes[i]);
    }, 70);
    return () => clearInterval(id);
  }, [fase, sorteo.participantes]);

  async function girar() {
    setErrMsg('');
    setFase('girando');
    try {
      const [actualizado] = await Promise.all([
        onEjecutar(),
        new Promise(r => setTimeout(r, 2600)),
      ]);
      setGanadores(actualizado.ganadores);
      setFase('resultado');
    } catch (e) {
      setErrMsg('Error al sortear: ' + e.message);
      setFase('confirmar');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container rounded-2xl p-6 w-full max-w-lg border border-outline-variant/20 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline font-bold text-lg">{sorteo.titulo}</h2>
          {fase !== 'girando' && (
            <button onClick={onCerrar} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {errMsg && <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2 mb-4">{errMsg}</p>}

        {fase === 'confirmar' && (
          <div className="space-y-5 text-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-variant rounded-xl p-4">
                <p className="font-headline text-3xl font-bold text-primary">{sorteo.participantes.length}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mt-1">Participantes</p>
              </div>
              <div className="bg-surface-variant rounded-xl p-4">
                <p className="font-headline text-3xl font-bold text-secondary">{sorteo.cantidadGanadores}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mt-1">Ganador(es)</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant">
              Premio: <strong className="text-on-surface">{sorteo.premio}</strong>
            </p>
            <button
              onClick={girar}
              className="w-full py-4 bg-gradient-to-r from-primary/25 to-secondary/25 border border-primary/30 text-primary hover:from-primary/35 hover:to-secondary/35 rounded-xl font-headline font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">casino</span>
              Girar la ruleta
            </button>
          </div>
        )}

        {fase === 'girando' && (
          <div className="py-10 text-center space-y-6">
            <span className="material-symbols-outlined text-primary text-5xl animate-spin">casino</span>
            <div className="bg-surface-variant border border-primary/30 rounded-xl py-6 px-4">
              <p className="font-headline text-2xl font-black truncate">{muestra}</p>
            </div>
            <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant animate-pulse">
              Sorteando…
            </p>
          </div>
        )}

        {fase === 'resultado' && (
          <div className="space-y-5">
            <p className="text-center text-xs uppercase tracking-widest font-bold text-secondary">
              {ganadores.length > 1 ? 'Ganadores' : 'Ganador'} · {sorteo.premio}
            </p>
            <div className="space-y-3">
              {ganadores.map((g, i) => (
                <div
                  key={`${g}-${i}`}
                  className="flex items-center gap-4 bg-gradient-to-r from-primary/15 to-transparent border border-primary/25 rounded-xl px-5 py-4"
                >
                  <span className="text-3xl shrink-0">{MEDALLAS[i] || '🎉'}</span>
                  <div className="min-w-0">
                    <p className="font-headline text-xl font-black truncate">{g}</p>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                      Puesto {i + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] uppercase tracking-widest text-on-surface-variant">
              Sorteado el {fmtFecha(sorteo.realizadoEn || new Date().toISOString())} entre {sorteo.participantes.length} participantes
            </p>
            <button
              onClick={onCerrar}
              className="w-full py-3 bg-surface-variant rounded-xl font-headline font-bold uppercase text-xs tracking-widest text-on-surface-variant hover:bg-outline/20 transition-all"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function SorteosPage() {
  const [sorteos, setSorteos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errMsg, setErrMsg] = useState('');
  const [sorteando, setSorteando] = useState(null); // sorteo en la ruleta
  const [verParticipantes, setVerParticipantes] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSorteos(await getSorteos());
    } catch (e) {
      setErrMsg('Error cargando sorteos: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setErrMsg('');
    setShowForm(true);
  }

  function openEdit(s) {
    setEditingId(s.id);
    setForm({
      ...emptyForm(),
      titulo: s.titulo,
      premio: s.premio,
      periodo: s.periodo,
      descripcion: s.descripcion,
      cantidadGanadores: s.cantidadGanadores,
      modo: 'nombres',
      listaTexto: s.participantes.join('\n'),
    });
    setErrMsg('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setErrMsg('');
  }

  async function handleSave() {
    const participantes = participantesDelForm(form);
    if (!form.titulo.trim()) return setErrMsg('Poné un título al sorteo');
    if (participantes.length < 2) return setErrMsg('Cargá al menos 2 participantes');
    if (form.cantidadGanadores > participantes.length) {
      return setErrMsg('No podés sortear más ganadores que participantes');
    }

    const original = editingId ? sorteos.find(s => s.id === editingId) : null;
    const listaCambio =
      original && original.participantes.join('|') !== participantes.join('|');
    if (original?.estado === 'realizado' && listaCambio) {
      const ok = window.confirm(
        'Este sorteo ya fue realizado. Al cambiar la lista de participantes se borra el resultado anterior y hay que volver a sortear. ¿Continuar?'
      );
      if (!ok) return;
    }

    setSaving(true);
    setErrMsg('');
    try {
      const payload = {
        titulo: form.titulo.trim(),
        premio: form.premio.trim() || PREMIO_DEFAULT,
        periodo: form.periodo.trim(),
        descripcion: form.descripcion.trim(),
        cantidadGanadores: Number(form.cantidadGanadores),
        participantes,
      };
      if (editingId) {
        if (original?.estado === 'realizado' && listaCambio) {
          payload.estado = 'pendiente';
          payload.ganadores = [];
          payload.realizadoEn = null;
          payload.publicado = false;
        }
        await updateSorteo(editingId, payload);
      } else {
        await addSorteo(payload);
      }
      closeForm();
      await refresh();
    } catch (e) {
      setErrMsg('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`¿Enviar el sorteo "${s.titulo}" a la papelera?`)) return;
    try {
      await deleteSorteo(s.id, s);
      await refresh();
    } catch (e) {
      setErrMsg('Error al eliminar: ' + e.message);
    }
  }

  async function handleTogglePublicado(s) {
    try {
      if (s.publicado) {
        await despublicarSorteo(s.id);
      } else {
        await publicarSorteo(s.id);
      }
      await refresh();
    } catch (e) {
      setErrMsg('Error: ' + e.message);
    }
  }

  function abrirRuleta(s, repetir = false) {
    if (repetir && !window.confirm('¿Volver a sortear? El resultado anterior se reemplaza.')) return;
    setSorteando(repetir ? { ...s, estado: 'pendiente', ganadores: [] } : s);
  }

  async function cerrarRuleta() {
    setSorteando(null);
    await refresh();
  }

  const publicado = sorteos.find(s => s.publicado);
  const stats = [
    { label: 'Sorteos', value: sorteos.length, icon: 'casino', color: 'text-primary' },
    { label: 'Realizados', value: sorteos.filter(s => s.estado === 'realizado').length, icon: 'emoji_events', color: 'text-secondary' },
    { label: 'Pendientes', value: sorteos.filter(s => s.estado === 'pendiente').length, icon: 'pending', color: 'text-tertiary' },
    { label: 'En portada', value: publicado ? 1 : 0, icon: 'campaign', color: 'text-on-surface-variant' },
  ];

  const previewParticipantes = participantesDelForm(form);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold">Sorteos</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Cargá participantes, sorteá al azar y publicá el ganador del mes en la página principal
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Nuevo Sorteo
        </button>
      </div>

      {errMsg && (
        <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">{errMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-surface-container border border-outline-variant/20 rounded-xl p-4">
            <span className={`material-symbols-outlined ${s.color} text-2xl mb-2`}>{s.icon}</span>
            <p className="font-headline text-2xl font-bold">{loading ? '—' : s.value}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Banner: qué se está mostrando en la portada */}
      {publicado && (
        <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="material-symbols-outlined text-secondary">campaign</span>
          <p className="text-sm flex-1 min-w-0">
            En la portada se muestra:{' '}
            <strong className="text-secondary">{publicado.titulo}</strong>{' '}
            — {publicado.ganadores.join(', ')}
          </p>
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl p-6 w-full max-w-lg border border-outline-variant/20 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-lg">{editingId ? 'Editar Sorteo' : 'Nuevo Sorteo'}</h2>
              <button onClick={closeForm} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {errMsg && <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{errMsg}</p>}

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Título</label>
              <input
                type="text"
                value={form.titulo}
                onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Sorteo mensual de Septiembre"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Premio</label>
                <input
                  type="text"
                  value={form.premio}
                  onChange={e => setForm(p => ({ ...p, premio: e.target.value }))}
                  placeholder={PREMIO_DEFAULT}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Período</label>
                <input
                  type="text"
                  value={form.periodo}
                  onChange={e => setForm(p => ({ ...p, periodo: e.target.value }))}
                  placeholder="Septiembre de 2026"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                Cantidad de ganadores
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, cantidadGanadores: n }))}
                    className={`flex-1 py-2.5 rounded-xl font-headline font-black text-sm transition-all border ${
                      Number(form.cantidadGanadores) === n
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-surface-variant text-on-surface-variant border-transparent hover:bg-outline/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={form.cantidadGanadores}
                  onChange={e => setForm(p => ({ ...p, cantidadGanadores: e.target.value }))}
                  className="input-field w-24 text-center"
                  title="Otra cantidad"
                />
              </div>
            </div>

            {/* Modo de carga */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Participantes</label>
              <div className="flex gap-2 mb-3">
                {[
                  { key: 'nombres', label: 'Lista de nombres', icon: 'format_list_bulleted' },
                  { key: 'numeros', label: 'Rango de números', icon: 'tag' },
                ].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, modo: m.key }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-headline font-bold uppercase text-[10px] tracking-widest transition-all border ${
                      form.modo === m.key
                        ? 'bg-secondary/20 text-secondary border-secondary/40'
                        : 'bg-surface-variant text-on-surface-variant border-transparent hover:bg-outline/20'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {form.modo === 'nombres' ? (
                <textarea
                  rows={7}
                  value={form.listaTexto}
                  onChange={e => setForm(p => ({ ...p, listaTexto: e.target.value }))}
                  placeholder={'Un participante por línea:\n\nMaría González\nLucía Fernández\nSofía Romero'}
                  className="input-field font-mono text-sm leading-relaxed resize-y"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1">Desde</label>
                    <input
                      type="number"
                      value={form.rangoDesde}
                      onChange={e => setForm(p => ({ ...p, rangoDesde: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant block mb-1">Hasta</label>
                    <input
                      type="number"
                      value={form.rangoHasta}
                      onChange={e => setForm(p => ({ ...p, rangoHasta: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-2">
                {previewParticipantes.length} participante{previewParticipantes.length === 1 ? '' : 's'}
                {form.modo === 'nombres' && ' · se ignoran líneas vacías y repetidos'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Entre todos los inscriptos de agosto"
                className="input-field"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Sorteo'}
              </button>
              <button
                onClick={closeForm}
                className="px-5 py-3 bg-surface-variant rounded-xl font-headline font-bold uppercase text-xs tracking-widest text-on-surface-variant hover:bg-outline/20 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ruleta */}
      {sorteando && (
        <ModalSorteo
          sorteo={sorteando}
          onCerrar={cerrarRuleta}
          onEjecutar={() => ejecutarSorteo(sorteando)}
        />
      )}

      {/* Modal lista de participantes */}
      {verParticipantes && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setVerParticipantes(null)}>
          <div className="bg-surface-container rounded-2xl p-6 w-full max-w-md border border-outline-variant/20 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline font-bold text-lg">
                Participantes ({verParticipantes.participantes.length})
              </h2>
              <button onClick={() => setVerParticipantes(null)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <ol className="overflow-y-auto space-y-1 text-sm">
              {verParticipantes.participantes.map((p, i) => (
                <li
                  key={`${p}-${i}`}
                  className={`flex gap-3 px-3 py-1.5 rounded-lg ${
                    verParticipantes.ganadores.includes(p) ? 'bg-primary/15 text-primary font-bold' : ''
                  }`}
                >
                  <span className="text-on-surface-variant tabular-nums w-8 shrink-0">{i + 1}.</span>
                  <span className="truncate">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl animate-spin">refresh</span>
        </div>
      ) : sorteos.length === 0 ? (
        <div className="bg-surface-container border border-outline-variant/20 rounded-xl text-center py-20">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">casino</span>
          <p className="font-headline font-bold text-lg mb-2">Todavía no hay sorteos</p>
          <p className="text-on-surface-variant text-sm mb-6">Creá el primer sorteo del curso gratuito de Audaces</p>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Crear Primer Sorteo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorteos.map(s => {
            const realizado = s.estado === 'realizado';
            return (
              <div
                key={s.id}
                className={`bg-surface-container border rounded-xl p-4 space-y-3 transition-all ${
                  s.publicado ? 'border-secondary/40' : 'border-outline-variant/20'
                }`}
              >
                {/* Fila superior */}
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-headline font-bold text-base truncate">{s.titulo}</h3>
                      {s.publicado && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-secondary/20 text-secondary">
                          En portada
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        realizado ? 'bg-primary/20 text-primary' : 'bg-outline/20 text-on-surface-variant'
                      }`}>
                        {realizado ? 'Realizado' : 'Pendiente'}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {s.premio}{s.periodo ? ` · ${s.periodo}` : ''}
                    </p>
                    <div className="flex gap-3 mt-1 text-[10px] text-on-surface-variant uppercase tracking-widest flex-wrap">
                      <button
                        onClick={() => setVerParticipantes(s)}
                        className="hover:text-primary transition-colors underline decoration-dotted"
                      >
                        {s.participantes.length} participantes
                      </button>
                      <span>{s.cantidadGanadores} ganador{s.cantidadGanadores === 1 ? '' : 'es'}</span>
                      {realizado && <span>Sorteado: {fmtFecha(s.realizadoEn)}</span>}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    {realizado && (
                      <button
                        onClick={() => handleTogglePublicado(s)}
                        className={`p-2 rounded-lg transition-all ${
                          s.publicado ? 'text-secondary hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-variant'
                        }`}
                        title={s.publicado ? 'Quitar de la portada' : 'Publicar en la portada'}
                      >
                        <span className="material-symbols-outlined text-xl">
                          {s.publicado ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-xl">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-2 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-all"
                      title="Eliminar"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>

                {/* Ganadores */}
                {realizado && s.ganadores.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {s.ganadores.map((g, i) => (
                      <span
                        key={`${g}-${i}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm font-bold"
                      >
                        <span>{MEDALLAS[i] || '🎉'}</span>
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Botón sortear */}
                <div className="flex gap-2 flex-wrap">
                  {!realizado ? (
                    <button
                      onClick={() => abrirRuleta(s)}
                      disabled={s.participantes.length < 2}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/25 to-secondary/25 border border-primary/30 text-primary hover:from-primary/35 hover:to-secondary/35 rounded-xl font-headline font-black uppercase text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-xl">casino</span>
                      Realizar sorteo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setSorteando(s)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-variant text-on-surface-variant hover:bg-outline/20 rounded-xl font-headline font-bold uppercase text-[10px] tracking-widest transition-all"
                      >
                        <span className="material-symbols-outlined text-base">emoji_events</span>
                        Ver resultado
                      </button>
                      <button
                        onClick={() => abrirRuleta(s, true)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-variant text-on-surface-variant hover:bg-outline/20 rounded-xl font-headline font-bold uppercase text-[10px] tracking-widest transition-all"
                      >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Volver a sortear
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
