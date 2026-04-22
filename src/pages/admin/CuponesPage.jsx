import React, { useState, useEffect, useCallback } from 'react';
import { getCupones, addCupon, updateCupon, deleteCupon } from '../../utils/cupones';
import { useAppSettings } from '../../context/AppSettingsContext';

const EMPTY_FORM = {
  code: '',
  type: 'percentage',
  value: '',
  description: '',
  expiresAt: '',
  maxUses: 0,
  active: true,
  isFlash: false,
};

export default function CuponesPage() {
  const { precio_base } = useAppSettings();
  const [cupones, setCupones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [copied, setCopied] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCupones(await getCupones());
    } catch (e) {
      setErrMsg('Error cargando cupones: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrMsg('');
    setShowForm(true);
  }

  function openEdit(cupon) {
    setEditingId(cupon.id);
    setForm({
      code: cupon.code,
      type: cupon.type,
      value: cupon.value,
      description: cupon.description || '',
      expiresAt: cupon.expiresAt
        ? new Date(cupon.expiresAt).toISOString().slice(0, 16)
        : '',
      maxUses: cupon.maxUses || 0,
      active: cupon.active,
      isFlash: cupon.isFlash || false,
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
    if (!form.code || !form.value) return;
    setSaving(true);
    setErrMsg('');
    try {
      const payload = {
        ...form,
        value: Number(form.value),
        maxUses: Number(form.maxUses),
        expiresAt: form.expiresAt || null,
      };
      if (editingId) {
        await updateCupon(editingId, payload);
      } else {
        await addCupon(payload);
      }
      closeForm();
      await refresh();
    } catch (e) {
      setErrMsg('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este cupón?')) return;
    try {
      await deleteCupon(id);
      await refresh();
    } catch (e) {
      setErrMsg('Error al eliminar: ' + e.message);
    }
  }

  async function handleToggle(cupon) {
    try {
      await updateCupon(cupon.id, { active: !cupon.active });
      await refresh();
    } catch (e) {
      setErrMsg('Error: ' + e.message);
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  const stats = [
    { label: 'Total Cupones', value: cupones.length, icon: 'confirmation_number', color: 'text-primary' },
    { label: 'Activos', value: cupones.filter(c => c.active).length, icon: 'check_circle', color: 'text-secondary' },
    { label: 'Flash ⚡', value: cupones.filter(c => c.isFlash && c.active).length, icon: 'bolt', color: 'text-tertiary' },
    { label: 'Usos totales', value: cupones.reduce((s, c) => s + (c.usedCount || 0), 0), icon: 'bar_chart', color: 'text-on-surface-variant' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold">Cupones de Descuento</h1>
          <p className="text-on-surface-variant text-sm mt-1">Gestiona cupones y promociones flash del curso Moldi Tex</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Nuevo Cupón
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

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl p-6 w-full max-w-md border border-outline-variant/20 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-lg">{editingId ? 'Editar Cupón' : 'Nuevo Cupón'}</h2>
              <button onClick={closeForm} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {errMsg && <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{errMsg}</p>}

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Código</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                placeholder="FLASH20"
                className="input-field uppercase tracking-widest font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="input-field"
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo ($)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">
                  {form.type === 'percentage' ? 'Descuento (%)' : 'Descuento ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder={form.type === 'percentage' ? '20' : '50000'}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Descripción</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Promo de inscripción temprana"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Vencimiento</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Máx. Usos (0=∞)</label>
                <input
                  type="number"
                  min="0"
                  value={form.maxUses}
                  onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm font-bold">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isFlash}
                  onChange={e => setForm(p => ({ ...p, isFlash: e.target.checked }))}
                  className="w-4 h-4 accent-tertiary"
                />
                <span className="text-sm font-bold">Promo Flash <span className="text-tertiary">⚡</span></span>
              </label>
            </div>

            {form.isFlash && (
              <p className="text-[10px] text-tertiary bg-tertiary/10 border border-tertiary/20 rounded-lg px-3 py-2 leading-relaxed">
                ⚡ Muestra banner con cuenta regresiva en la landing page. Requiere fecha de vencimiento.
              </p>
            )}

            {/* Preview */}
            {form.value && (
              <div className="bg-surface-variant rounded-xl p-3 border border-outline-variant/20">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Vista previa del descuento</p>
                <p className="text-sm font-bold">
                  Precio original: ${precio_base.toLocaleString('es-AR')} →{' '}
                  <span className="text-secondary">
                    ${Math.max(0,
                      form.type === 'percentage'
                        ? precio_base - Math.round(precio_base * Number(form.value) / 100)
                        : precio_base - Number(form.value)
                    ).toLocaleString('es-AR')}
                  </span>
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={!form.code || !form.value || saving}
                className="flex-1 py-3 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Cupón'}
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

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl animate-spin">refresh</span>
        </div>
      ) : cupones.length === 0 ? (
        <div className="bg-surface-container border border-outline-variant/20 rounded-xl text-center py-20">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">confirmation_number</span>
          <p className="font-headline font-bold text-lg mb-2">Sin cupones creados</p>
          <p className="text-on-surface-variant text-sm mb-6">Crea el primer cupón de descuento para el curso</p>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Crear Primer Cupón
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cupones.map(cupon => {
            const expired = cupon.expiresAt && new Date(cupon.expiresAt) < new Date();
            const exhausted = cupon.maxUses > 0 && cupon.usedCount >= cupon.maxUses;
            return (
              <div
                key={cupon.id}
                className={`bg-surface-container border rounded-xl flex flex-wrap md:flex-nowrap items-center gap-4 p-4 transition-all ${
                  cupon.active && !expired && !exhausted
                    ? 'border-outline-variant/20'
                    : 'border-outline-variant/10 opacity-55'
                }`}
              >
                {/* Code */}
                <button
                  onClick={() => copyCode(cupon.code)}
                  title="Copiar código"
                  className={`shrink-0 px-3 py-2 rounded-lg font-headline font-black text-sm tracking-widest uppercase transition-all hover:scale-105 ${
                    cupon.isFlash ? 'bg-tertiary/20 text-tertiary' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {copied === cupon.code ? '✓ Copiado' : cupon.code}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-headline font-bold text-sm">
                      {cupon.type === 'percentage'
                        ? `${cupon.value}% OFF`
                        : `$${Number(cupon.value).toLocaleString('es-AR')} OFF`}
                    </span>
                    {cupon.isFlash && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary">⚡ Flash</span>}
                    {expired && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-error/20 text-error">Expirado</span>}
                    {exhausted && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-error/20 text-error">Agotado</span>}
                    {!cupon.active && !expired && !exhausted && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-outline/20 text-on-surface-variant">Inactivo</span>}
                  </div>
                  {cupon.description && (
                    <p className="text-xs text-on-surface-variant truncate">{cupon.description}</p>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-on-surface-variant uppercase tracking-widest flex-wrap">
                    {cupon.expiresAt && (
                      <span>Vence: {new Date(cupon.expiresAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    )}
                    <span>{cupon.usedCount || 0} / {cupon.maxUses > 0 ? cupon.maxUses : '∞'} usos</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(cupon)}
                    className={`p-2 rounded-lg transition-all ${cupon.active ? 'text-secondary hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                    title={cupon.active ? 'Desactivar' : 'Activar'}
                  >
                    <span className="material-symbols-outlined text-xl">{cupon.active ? 'toggle_on' : 'toggle_off'}</span>
                  </button>
                  <button
                    onClick={() => openEdit(cupon)}
                    className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(cupon.id)}
                    className="p-2 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-all"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
