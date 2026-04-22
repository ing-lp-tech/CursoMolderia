import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function ConfiguracionPage() {
  const { refetch } = useAppSettings();
  const [form, setForm] = useState({
    precio_base: '',
    precio_tachado: '',
    fecha_inicio: '',
    test_mode_mp: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('id, value')
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map(r => [r.id, r.value]));
          setForm({
            precio_base: map.precio_base ?? '400000',
            precio_tachado: map.precio_tachado ?? '650000',
            fecha_inicio: map.fecha_inicio ?? '13 de Marzo',
            test_mode_mp: map.test_mode_mp === true || map.test_mode_mp === 'true',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const rows = [
      { id: 'precio_base',    value: String(Number(form.precio_base)) },
      { id: 'precio_tachado', value: String(Number(form.precio_tachado)) },
      { id: 'fecha_inicio',   value: form.fecha_inicio.trim() },
      { id: 'test_mode_mp',   value: String(form.test_mode_mp) },
    ];

    const { error: err } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'id' });

    if (err) {
      setError(err.message);
    } else {
      refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  const precioBase = Number(form.precio_base) || 0;
  const precioTachado = Number(form.precio_tachado) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-headline text-2xl font-bold">Configuración del Sitio</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Los cambios se reflejan en tiempo real en la landing y la página de inscripción.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Precios */}
        <div className="card border border-outline-variant/20 space-y-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">sell</span>
            <h3 className="font-headline font-bold text-base">Precio del Curso</h3>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Precio base (ARS)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.precio_base}
                onChange={e => setForm(p => ({ ...p, precio_base: e.target.value }))}
                className="input-field pl-8"
                required
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              Precio real del curso. Los pagos al 50% y 25% se calculan automáticamente sobre este valor.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Precio tachado / referencia (ARS)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.precio_tachado}
                onChange={e => setForm(p => ({ ...p, precio_tachado: e.target.value }))}
                className="input-field pl-8"
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              Se muestra tachado como precio "original" en la landing page.
            </p>
          </div>

          {/* Vista previa */}
          <div className="bg-surface-variant rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Vista previa</p>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-headline font-bold">${precioBase.toLocaleString('es-AR')}</span>
              {precioTachado > 0 && (
                <span className="text-on-surface-variant line-through text-sm">${precioTachado.toLocaleString('es-AR')}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Completo', ratio: 1 },
                { label: 'Anticipo 50%', ratio: 0.5 },
                { label: 'Anticipo 25%', ratio: 0.25 },
              ].map(({ label, ratio }) => (
                <div key={ratio} className="bg-surface-container rounded-lg p-3 text-center">
                  <p className="text-[9px] font-bold uppercase text-on-surface-variant mb-1">{label}</p>
                  <p className="font-headline font-bold text-sm">${Math.round(precioBase * ratio).toLocaleString('es-AR')}</p>
                  {ratio < 1 && (
                    <p className="text-[9px] text-on-surface-variant mt-0.5">
                      + ${Math.round(precioBase * (1 - ratio)).toLocaleString('es-AR')} efectivo
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Información del curso */}
        <div className="card border border-outline-variant/20 space-y-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <h3 className="font-headline font-bold text-base">Información del Curso</h3>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Fecha de inicio
            </label>
            <input
              type="text"
              value={form.fecha_inicio}
              onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
              className="input-field"
              placeholder="Ej: 13 de Marzo"
            />
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              Aparece en el badge de la landing y en el sidebar de inscripción.
            </p>
          </div>
        </div>

        {/* Modo prueba MP */}
        <div className="card border border-outline-variant/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-error">bug_report</span>
            <h3 className="font-headline font-bold text-base">Modo Prueba MercadoPago</h3>
          </div>
          <label className="flex items-center gap-4 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, test_mode_mp: !p.test_mode_mp }))}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${form.test_mode_mp ? 'bg-error' : 'bg-outline-variant/50'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.test_mode_mp ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <div>
              <p className="text-sm font-bold">{form.test_mode_mp ? 'Activado' : 'Desactivado'}</p>
              <p className="text-xs text-on-surface-variant">Muestra el plan de $100 para probar el flujo de MercadoPago.</p>
            </div>
          </label>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">{error}</div>
        )}

        {saved && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 text-sm text-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            ¡Configuración guardada! Los cambios ya están activos en el sitio.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saving ? (
            <><span className="material-symbols-outlined animate-spin text-sm">refresh</span>Guardando...</>
          ) : (
            <><span className="material-symbols-outlined text-sm">save</span>Guardar configuración</>
          )}
        </button>
      </form>
    </div>
  );
}
