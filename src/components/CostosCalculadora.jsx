import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  nombre_proyecto: '',
  fecha: TODAY,
  unidad_tela: 'metros',
  cantidad_prendas: 1,
  fabric_qty: '',
  fabric_price: '',
  costo_costura: '',
  margen_ganancia: 30,
};

const EMPTY_INSUMO = { nombre: '', cantidad: '', precio: '' };

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CostosCalculadora({ estudianteId }) {
  const [calculos, setCalculos]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [insumos, setInsumos]         = useState([]);
  const [insumoForm, setInsumoForm]   = useState({ ...EMPTY_INSUMO });
  const [resultados, setResultados]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [expandedId, setExpandedId]   = useState(null);

  const loadCalculos = useCallback(async () => {
    if (!estudianteId) return;
    setLoading(true);
    const { data } = await supabase
      .from('costos_alumnos')
      .select('*')
      .eq('estudiante_id', estudianteId)
      .order('created_at', { ascending: false });
    setCalculos(data || []);
    setLoading(false);
  }, [estudianteId]);

  useEffect(() => { loadCalculos(); }, [loadCalculos]);

  // ── Lógica de cálculo ──────────────────────────────────────────────────────
  function calcular() {
    const qty     = Number(form.fabric_qty)      || 0;
    const price   = Number(form.fabric_price)    || 0;
    const prendas = Number(form.cantidad_prendas)|| 1;
    const costura = Number(form.costo_costura)   || 0;
    const margen  = Number(form.margen_ganancia) || 0;

    const costo_tela_total    = qty * price;
    const costo_costura_total = costura * prendas;
    const costo_insumos_total = insumos.reduce(
      (a, i) => a + (Number(i.cantidad) * Number(i.precio) * prendas), 0
    );
    const costo_total    = costo_tela_total + costo_costura_total + costo_insumos_total;
    const costo_unitario = prendas > 0 ? costo_total / prendas : 0;
    const precio_venta   = margen < 100 ? costo_unitario / (1 - margen / 100) : 0;

    setResultados({ costo_tela_total, costo_costura_total, costo_insumos_total, costo_total, costo_unitario, precio_venta });
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  async function guardar() {
    if (!form.nombre_proyecto.trim() || !resultados) return;
    setSaving(true);
    const payload = {
      estudiante_id:      estudianteId,
      nombre_proyecto:    form.nombre_proyecto.trim(),
      fecha:              form.fecha,
      unidad_tela:        form.unidad_tela,
      cantidad_prendas:   Number(form.cantidad_prendas),
      fabric_qty:         Number(form.fabric_qty)      || 0,
      fabric_price:       Number(form.fabric_price)    || 0,
      costo_costura:      Number(form.costo_costura)   || 0,
      detalle_insumos:    insumos,
      margen_ganancia:    Number(form.margen_ganancia) || 0,
      updated_at:         new Date().toISOString(),
      ...resultados,
    };

    const { error } = editingId
      ? await supabase.from('costos_alumnos').update(payload).eq('id', editingId)
      : await supabase.from('costos_alumnos').insert(payload);

    if (error) { alert('Error al guardar: ' + error.message); }
    else { await loadCalculos(); resetForm(); }
    setSaving(false);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setInsumos([]);
    setInsumoForm({ ...EMPTY_INSUMO });
    setResultados(null);
    setEditingId(null);
    setShowForm(false);
  }

  function cargarParaEditar(c) {
    setForm({
      nombre_proyecto:  c.nombre_proyecto,
      fecha:            c.fecha,
      unidad_tela:      c.unidad_tela,
      cantidad_prendas: c.cantidad_prendas,
      fabric_qty:       c.fabric_qty,
      fabric_price:     c.fabric_price,
      costo_costura:    c.costo_costura,
      margen_ganancia:  c.margen_ganancia,
    });
    setInsumos(c.detalle_insumos || []);
    setResultados({
      costo_tela_total:    c.costo_tela_total,
      costo_costura_total: c.costo_costura_total,
      costo_insumos_total: c.costo_insumos_total,
      costo_total:         c.costo_total,
      costo_unitario:      c.costo_unitario,
      precio_venta:        c.precio_venta,
    });
    setEditingId(c.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este cálculo?')) return;
    await supabase.from('costos_alumnos').delete().eq('id', id);
    setCalculos(prev => prev.filter(c => c.id !== id));
    if (editingId === id) resetForm();
  }

  function agregarInsumo() {
    if (!insumoForm.nombre.trim() || !insumoForm.cantidad || !insumoForm.precio) return;
    setInsumos(prev => [...prev, { ...insumoForm }]);
    setInsumoForm({ ...EMPTY_INSUMO });
    setResultados(null);
  }

  const labelTela = form.unidad_tela === 'metros' ? 'Metro' : 'Kilo';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-headline font-bold text-sm uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">calculate</span>
            Calculadora de Costos
          </h4>
          <p className="text-xs text-on-surface-variant mt-0.5">Calculá el costo y precio sugerido de tus proyectos</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo cálculo
          </button>
        )}
      </div>

      {/* ── Formulario ── */}
      {showForm && (
        <div className="rounded-2xl border-2 border-primary/30 overflow-hidden">
          {/* Título del form */}
          <div className="px-5 py-3 bg-primary/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">edit_note</span>
              <span className="text-sm font-bold text-primary">{editingId ? 'Editando cálculo' : 'Nuevo cálculo'}</span>
            </div>
            <button type="button" onClick={resetForm} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="p-5 space-y-6">

            {/* Datos del proyecto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Nombre del proyecto *</label>
                <input
                  type="text"
                  value={form.nombre_proyecto}
                  onChange={e => setForm(p => ({ ...p, nombre_proyecto: e.target.value }))}
                  className="input-field text-sm"
                  placeholder="Ej: Pantalón verano"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className="input-field text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Cantidad de prendas</label>
                <input
                  type="number" min="1" value={form.cantidad_prendas}
                  onChange={e => { setForm(p => ({ ...p, cantidad_prendas: e.target.value })); setResultados(null); }}
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Material principal */}
            <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
              <div className="px-4 py-2 bg-surface-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-sm">straighten</span>
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">Material Principal (Tela)</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Unidad de medida</label>
                  <div className="flex rounded-xl overflow-hidden border border-outline-variant/30">
                    {['metros', 'kilos'].map(u => (
                      <button key={u} type="button"
                        onClick={() => { setForm(p => ({ ...p, unidad_tela: u })); setResultados(null); }}
                        className={`flex-1 py-2 text-xs font-bold capitalize transition-all ${form.unidad_tela === u ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                      >{u}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                    Total {labelTela}s utilizados
                  </label>
                  <input
                    type="number" min="0" step="0.01" value={form.fabric_qty}
                    onChange={e => { setForm(p => ({ ...p, fabric_qty: e.target.value })); setResultados(null); }}
                    className="input-field text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                    Precio por {labelTela}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">$</span>
                    <input
                      type="number" min="0" step="0.01" value={form.fabric_price}
                      onChange={e => { setForm(p => ({ ...p, fabric_price: e.target.value })); setResultados(null); }}
                      className="input-field pl-7 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Confección */}
            <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
              <div className="px-4 py-2 bg-surface-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-sm">content_cut</span>
                <span className="text-xs font-bold uppercase tracking-widest text-tertiary">Confección</span>
              </div>
              <div className="p-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Costo de costura (por prenda)</label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01" value={form.costo_costura}
                    onChange={e => { setForm(p => ({ ...p, costo_costura: e.target.value })); setResultados(null); }}
                    className="input-field pl-7 text-sm"
                    placeholder="Ej: 500"
                  />
                </div>
              </div>
            </div>

            {/* Insumos adicionales */}
            <div className="rounded-xl border border-outline-variant/20 overflow-hidden">
              <div className="px-4 py-2 bg-surface-variant/40 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-sm">inventory_2</span>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Insumos Adicionales</span>
              </div>
              <div className="p-4 space-y-3">
                {/* Lista de insumos */}
                {insumos.length > 0 && (
                  <div className="space-y-1.5">
                    {insumos.map((ins, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-surface-variant/30 rounded-lg px-3 py-2 text-sm">
                        <span className="font-bold flex-1">{ins.nombre}</span>
                        <span className="text-on-surface-variant text-xs">
                          {ins.cantidad} u/prenda × ${Number(ins.precio).toLocaleString('es-AR')} =
                          <span className="font-bold text-on-surface ml-1">
                            ${(Number(ins.cantidad) * Number(ins.precio)).toLocaleString('es-AR')} / prenda
                          </span>
                        </span>
                        <button type="button" onClick={() => { setInsumos(p => p.filter((_, i) => i !== idx)); setResultados(null); }}
                          className="text-on-surface-variant hover:text-error transition-colors shrink-0">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Formulario agregar insumo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    type="text" value={insumoForm.nombre}
                    onChange={e => setInsumoForm(p => ({ ...p, nombre: e.target.value }))}
                    className="input-field py-1.5 text-sm sm:col-span-1"
                    placeholder="Ej: Botones"
                  />
                  <input
                    type="number" min="0" value={insumoForm.cantidad}
                    onChange={e => setInsumoForm(p => ({ ...p, cantidad: e.target.value }))}
                    className="input-field py-1.5 text-sm"
                    placeholder="Cant. por prenda"
                  />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs">$</span>
                    <input
                      type="number" min="0" value={insumoForm.precio}
                      onChange={e => setInsumoForm(p => ({ ...p, precio: e.target.value }))}
                      className="input-field pl-6 py-1.5 text-sm"
                      placeholder="Costo unitario"
                    />
                  </div>
                  <button type="button" onClick={agregarInsumo}
                    disabled={!insumoForm.nombre.trim() || !insumoForm.cantidad || !insumoForm.precio}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40">
                    <span className="material-symbols-outlined text-sm">add</span>Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Margen */}
            <div className="flex items-center gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">Margen de ganancia (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="99" value={form.margen_ganancia}
                    onChange={e => { setForm(p => ({ ...p, margen_ganancia: e.target.value })); setResultados(null); }}
                    className="input-field text-sm w-24"
                  />
                  <span className="text-on-surface-variant font-bold">%</span>
                </div>
              </div>
              <button
                type="button"
                onClick={calcular}
                disabled={!form.nombre_proyecto.trim() || !form.fabric_qty || !form.fabric_price}
                className="mt-5 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-container-highest border border-outline-variant/30 hover:bg-surface-variant font-headline font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-sm">calculate</span>
                Calcular
              </button>
            </div>

            {/* Resultados */}
            {resultados && (
              <div className="rounded-xl overflow-hidden border border-outline-variant/20">
                <div className="px-4 py-2 bg-surface-variant/40">
                  <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Resultados</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/20">
                  <div className="p-4 border-l-4 border-secondary">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Costo Total Lote</p>
                    <p className="font-headline text-2xl font-black text-secondary">${fmt(resultados.costo_total)}</p>
                    <div className="mt-2 space-y-0.5 text-[10px] text-on-surface-variant">
                      <p>Tela: ${fmt(resultados.costo_tela_total)}</p>
                      <p>Costura: ${fmt(resultados.costo_costura_total)}</p>
                      <p>Insumos: ${fmt(resultados.costo_insumos_total)}</p>
                    </div>
                  </div>
                  <div className="p-4 border-l-4 border-primary">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Costo Unitario</p>
                    <p className="font-headline text-2xl font-black text-primary">${fmt(resultados.costo_unitario)}</p>
                    <p className="text-[10px] text-on-surface-variant mt-2">Por prenda</p>
                  </div>
                  <div className="p-4 border-l-4 border-tertiary">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Precio Sugerido</p>
                    <p className="font-headline text-2xl font-black text-tertiary">${fmt(resultados.precio_venta)}</p>
                    <p className="text-[10px] text-on-surface-variant mt-2">Con {form.margen_ganancia}% de margen</p>
                  </div>
                </div>
              </div>
            )}

            {/* Guardar */}
            <div className="flex gap-3">
              <button type="button" onClick={resetForm} className="btn-secondary flex-1">Cancelar</button>
              <button
                type="button"
                onClick={guardar}
                disabled={!resultados || !form.nombre_proyecto.trim() || saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving
                  ? <><span className="material-symbols-outlined animate-spin text-sm">sync</span>Guardando...</>
                  : <><span className="material-symbols-outlined text-sm">save</span>{editingId ? 'Actualizar' : 'Guardar cálculo'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="material-symbols-outlined animate-spin text-primary">refresh</span>
        </div>
      ) : calculos.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3">calculate</span>
          <p className="text-sm">No hay cálculos guardados aún.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-primary hover:underline font-bold">
            Crear el primero
          </button>
        </div>
      ) : calculos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Historial de cálculos</p>
          {calculos.map(c => (
            <div key={c.id} className="rounded-xl border border-outline-variant/20 overflow-hidden">
              {/* Fila resumen */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-variant/30 transition-all"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{c.nombre_proyecto}</p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(c.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{c.cantidad_prendas} prendas
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-on-surface-variant">Precio sugerido</p>
                  <p className="font-headline font-black text-tertiary">${fmt(c.precio_venta)}</p>
                </div>
                <span className={`material-symbols-outlined text-on-surface-variant text-sm transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>

              {/* Detalle expandido */}
              {expandedId === c.id && (
                <div className="border-t border-outline-variant/20 p-4 bg-surface-variant/20 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 rounded-lg bg-secondary/10">
                      <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">Costo total lote</p>
                      <p className="font-bold text-secondary">${fmt(c.costo_total)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-primary/10">
                      <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">Costo unitario</p>
                      <p className="font-bold text-primary">${fmt(c.costo_unitario)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-tertiary/10">
                      <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">Precio sugerido</p>
                      <p className="font-bold text-tertiary">${fmt(c.precio_venta)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-on-surface-variant space-y-0.5">
                    <p>Tela: {c.fabric_qty} {c.unidad_tela} × ${fmt(c.fabric_price)} / {c.unidad_tela === 'metros' ? 'metro' : 'kilo'}</p>
                    <p>Costura: ${fmt(c.costo_costura)} / prenda · Margen: {c.margen_ganancia}%</p>
                    {(c.detalle_insumos || []).length > 0 && (
                      <p>Insumos: {c.detalle_insumos.map(i => i.nombre).join(', ')}</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => cargarParaEditar(c)}
                      className="flex-1 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 text-xs font-bold transition-all flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">edit</span>Editar
                    </button>
                    <button onClick={() => eliminar(c.id)}
                      className="px-4 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 text-xs font-bold transition-all">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
