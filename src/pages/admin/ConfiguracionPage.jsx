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
    site_url: 'https://www.molderia-digital.com',
    moldes_cbu: '',
    moldes_alias: '',
    moldes_titular: '',
    moldes_banco: '',
    moldes_descuento_transferencia: '0',
    moldes_whatsapp_comprobante: '',
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
            precio_base:    map.precio_base    ?? '400000',
            precio_tachado: map.precio_tachado ?? '650000',
            fecha_inicio:   map.fecha_inicio   ?? '13 de Marzo',
            test_mode_mp:   map.test_mode_mp === true || map.test_mode_mp === 'true',
            site_url:       map.site_url ?? 'https://www.molderia-digital.com',
            moldes_cbu:                     map.moldes_cbu                     ?? '',
            moldes_alias:                   map.moldes_alias                   ?? '',
            moldes_titular:                 map.moldes_titular                 ?? '',
            moldes_banco:                   map.moldes_banco                   ?? '',
            moldes_descuento_transferencia: map.moldes_descuento_transferencia ?? '0',
            moldes_whatsapp_comprobante:    map.moldes_whatsapp_comprobante    ?? '',
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
      { id: 'site_url',       value: form.site_url.trim() },
      { id: 'moldes_cbu',                     value: form.moldes_cbu.trim() },
      { id: 'moldes_alias',                   value: form.moldes_alias.trim() },
      { id: 'moldes_titular',                 value: form.moldes_titular.trim() },
      { id: 'moldes_banco',                   value: form.moldes_banco.trim() },
      { id: 'moldes_descuento_transferencia', value: String(Number(form.moldes_descuento_transferencia) || 0) },
      { id: 'moldes_whatsapp_comprobante',    value: form.moldes_whatsapp_comprobante.trim().replace(/\D/g, '') },
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

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              URL del sitio web
            </label>
            <input
              type="url"
              value={form.site_url}
              onChange={e => setForm(p => ({ ...p, site_url: e.target.value }))}
              className="input-field"
              placeholder="https://www.molderia-digital.com"
            />
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              Link que se envía por WhatsApp al consultar o al compartir datos de acceso a alumnos.
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

        {/* Moldes y Pagos */}
        <div className="card border border-outline-variant/20 space-y-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">straighten</span>
            <h3 className="font-headline font-bold text-base">Moldes — Métodos de Pago</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">CBU</label>
              <input type="text" value={form.moldes_cbu}
                onChange={e => setForm(p => ({ ...p, moldes_cbu: e.target.value }))}
                className="input-field font-mono" placeholder="0000000000000000000000" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Alias</label>
              <input type="text" value={form.moldes_alias}
                onChange={e => setForm(p => ({ ...p, moldes_alias: e.target.value }))}
                className="input-field" placeholder="molditex.pagos" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Titular de la cuenta</label>
              <input type="text" value={form.moldes_titular}
                onChange={e => setForm(p => ({ ...p, moldes_titular: e.target.value }))}
                className="input-field" placeholder="Nombre Apellido" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Banco</label>
              <input type="text" value={form.moldes_banco}
                onChange={e => setForm(p => ({ ...p, moldes_banco: e.target.value }))}
                className="input-field" placeholder="Banco Galicia" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              Descuento por transferencia (%)
            </label>
            <input type="number" min="0" max="100" step="1" value={form.moldes_descuento_transferencia}
              onChange={e => setForm(p => ({ ...p, moldes_descuento_transferencia: e.target.value }))}
              className="input-field w-32" />
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              0 = la opción de transferencia no aparece en el checkout.
              {Number(form.moldes_descuento_transferencia) > 0 && (
                <span className="text-secondary ml-1">
                  Actualmente: {form.moldes_descuento_transferencia}% de descuento al pagar por transferencia.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
              WhatsApp para comprobantes y envío de links
            </label>
            <input type="text" value={form.moldes_whatsapp_comprobante}
              onChange={e => setForm(p => ({ ...p, moldes_whatsapp_comprobante: e.target.value }))}
              className="input-field font-mono" placeholder="5491162020911" />
            <p className="text-[10px] text-on-surface-variant mt-1.5">
              Solo números, sin + ni espacios. Ej: 5491162020911 (código país + área + número).
            </p>
          </div>
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
