import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import mpLogo from '../assets/mp.svg';
import { validateCupon, useCupon } from '../utils/cupones';

const WAPP = '5491162020911';
const WAPP_MSG = encodeURIComponent('Hola! Quiero inscribirme al curso de moldería con Audaces. Me gustaría recibir más información.');

const CAMPOS = [
  { id: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Ana' },
  { id: 'apellido', label: 'Apellido', type: 'text', placeholder: 'García' },
  { id: 'email', label: 'Email', type: 'email', placeholder: 'ana@ejemplo.com' },
  { id: 'telefono', label: 'WhatsApp / Teléfono', type: 'tel', placeholder: '+54 11 0000-0000' },
];

const BASE_TOTAL = 400000;

const PLANES = [
  {
    id: 'completo_mp',
    label: 'Pago Completo — MercadoPago',
    monto: 400000,
    badge: 'Recomendado',
    badgeColor: 'bg-secondary/20 text-secondary',
    desc: 'Pagá el total por MercadoPago (transferencia, tarjeta, débito).',
    icon: 'credit_card',
    color: 'border-secondary',
    ratio: 1,
  },
  {
    id: 'anticipo_50',
    label: 'Anticipo 50% — MercadoPago',
    monto: 200000,
    badge: '+ resto en efectivo',
    badgeColor: 'bg-primary/20 text-primary',
    desc: 'Pagá el 50% ahora por MercadoPago y el resto en efectivo el día del inicio.',
    icon: 'payments',
    color: 'border-primary',
    ratio: 0.5,
  },
  {
    id: 'anticipo_25',
    label: 'Anticipo 25% — MercadoPago',
    monto: 100000,
    badge: '+ resto en efectivo',
    badgeColor: 'bg-tertiary/20 text-tertiary',
    desc: 'Pagá el 25% ahora por MercadoPago y el resto en efectivo el día del inicio.',
    icon: 'account_balance_wallet',
    color: 'border-tertiary',
    ratio: 0.25,
  },
  {
    id: 'prueba_100',
    label: '⚡ MODO PRUEBA — $100',
    monto: 100,
    badge: 'Test Real',
    badgeColor: 'bg-error/20 text-error',
    desc: 'Plan exclusivo temporal para probar que MercadoPago descuenta dinero real correctamente.',
    icon: 'bug_report',
    color: 'border-error',
    ratio: null,
  },
];

/** Returns the MP amount for a plan after applying coupon discount */
function getMontoConDescuento(plan, cuponResult) {
  if (plan.ratio === null || !cuponResult?.valid) return plan.monto;
  const discountedTotal = cuponResult.finalPrice; // BASE_TOTAL - discount
  return Math.max(0, Math.round(discountedTotal * plan.ratio));
}

export default function InscripcionPage() {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', plan: 'completo_mp', consulta: '' });
  const [estado, setEstado] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [testMode, setTestMode] = useState(false);

  // Coupon state
  const [cuponInput, setCuponInput] = useState('');
  const [cuponResult, setCuponResult] = useState(null);
  const [cuponLoading, setCuponLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const planSeleccionado = PLANES.find(p => p.id === form.plan);
  const montoEfectivo = getMontoConDescuento(planSeleccionado, cuponResult);

  // Remaining cash amount for partial plans
  function getCashResto(plan) {
    if (plan.ratio === null || plan.ratio === 1) return 0;
    const discountedTotal = cuponResult?.valid ? cuponResult.finalPrice : BASE_TOTAL;
    return Math.max(0, discountedTotal - Math.round(discountedTotal * plan.ratio));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isUrlTest = params.get('test') === 'true';
    const urlCupon = params.get('cupon');

    // Pre-fill coupon from URL (from flash promo banner)
    if (urlCupon) {
      const code = urlCupon.toUpperCase();
      setCuponInput(code);
      validateCupon(code, BASE_TOTAL).then(result => {
        if (result.valid) setCuponResult(result);
      }).catch(() => {});
    }

    supabase.from('app_settings').select('value').eq('id', 'test_mode_mp').single().then(({ data }) => {
      if (data?.value === true || isUrlTest) {
        setTestMode(true);
      } else {
        if (form.plan === 'prueba_100') setForm(prev => ({ ...prev, plan: 'completo_mp' }));
      }
    }).catch(() => {
      if (isUrlTest) setTestMode(true);
    });

    if (params.get('status') === 'approved' || params.get('status') === 'success') {
      setEstado('success');
    } else if (params.get('status') === 'failure') {
      setEstado('error');
      setErrMsg('El pago ha fallado o fue rechazado. Podés intentar nuevamente.');
    }
  }, []);

  async function handleAplicarCupon() {
    const code = cuponInput.trim();
    if (!code) return;
    setCuponLoading(true);
    setErrMsg('');
    try {
      const result = await validateCupon(code, BASE_TOTAL);
      setCuponResult(result.valid ? result : null);
      if (!result.valid) setErrMsg(result.error);
    } catch {
      setErrMsg('Error al validar el cupón. Intenta de nuevo.');
    } finally {
      setCuponLoading(false);
    }
  }

  function handleRemoveCupon() {
    setCuponInput('');
    setCuponResult(null);
    setErrMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado('loading');
    setErrMsg('');
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: Math.random().toString(36).slice(-10) + 'A1!',
        options: {
          data: { nombre: form.nombre, apellido: form.apellido, telefono: form.telefono, rol: 'estudiante' },
        },
      });
      if (authErr && !authErr.message.includes('already registered')) throw authErr;

      const userId = authData?.user?.id || (await supabase.auth.getUser()).data?.user?.id;

      const cuponLabel = cuponResult?.valid ? ` | Cupón: ${cuponResult.cupon.code} (${cuponResult.label})` : '';

      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer_email: form.email,
          items: [{
            title: `Inscripción Curso Moldi Tex - ${planSeleccionado?.label}${cuponLabel}`,
            unit_price: montoEfectivo,
            quantity: 1,
            currency_id: 'ARS',
          }],
        }),
      });

      const mpData = await res.json();
      if (!res.ok) throw new Error(mpData.error || 'Error al generar link de pago');

      if (userId) {
        await supabase.from('pagos').insert({
          estudiante_id: userId,
          monto: montoEfectivo,
          monto_original: planSeleccionado?.monto || BASE_TOTAL,
          descuento_aplicado: cuponResult?.valid ? cuponResult.discount : 0,
          cupon_codigo: cuponResult?.valid ? cuponResult.cupon.code : null,
          moneda: 'ARS',
          metodo_pago: 'mercadopago',
          estado: 'pendiente',
          concepto: `Inscripción Curso Moldería — ${planSeleccionado?.label}${cuponLabel}`,
          notas: `Preferencia MP: ${mpData.id} | Consulta: ${form.consulta}`,
        });
      }

      // Register coupon usage
      if (cuponResult?.valid) {
        useCupon(cuponResult.cupon.id);
      }

      window.location.href = mpData.init_point;
    } catch (err) {
      setEstado('error');
      setErrMsg(err.message || 'Ocurrió un error. Intenta de nuevo.');
    }
  }

  if (estado === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-secondary text-8xl mb-4">task_alt</span>
          <h2 className="font-headline text-4xl font-black mt-4 mb-3">¡Pago Aprobado!</h2>
          <p className="text-on-surface-variant mb-8 text-lg">
            Tu lugar ya está asegurado. Te enviamos un correo con todos los detalles de acceso y el comprobante oficial.
          </p>
          <a
            href="/student"
            className="btn-primary inline-flex items-center gap-3 text-lg px-8 py-4 w-full justify-center"
          >
            Ir a Mi Plataforma
            <span className="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
      </div>
    );
  }

  const planesActivos = testMode ? PLANES : PLANES.filter(p => p.id !== 'prueba_100');
  const totalConDescuento = cuponResult?.valid ? cuponResult.finalPrice : BASE_TOTAL;

  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="badge-error mb-4">Cupos Limitados</span>
          <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tighter mt-4 mb-4">
            Asegura tu <span className="gradient-text">lugar</span> en el aula
          </h1>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            Este es un <strong>curso 100% presencial</strong>. Elegí tu plan de pago, completá el formulario y confirmá tu inscripción.
          </p>
        </div>

        {/* Flash promo hint if coupon applied */}
        {cuponResult?.valid && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-tertiary/10 border border-tertiary/30 rounded-xl">
            <span className="material-symbols-outlined text-tertiary text-xl">local_offer</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-tertiary">
                Cupón <span className="uppercase tracking-widest">{cuponResult.cupon.code}</span> aplicado — {cuponResult.label}
              </p>
              <p className="text-xs text-on-surface-variant">
                Precio total: <span className="line-through">${BASE_TOTAL.toLocaleString('es-AR')}</span>
                {' '}→{' '}
                <span className="font-bold text-on-surface">${totalConDescuento.toLocaleString('es-AR')}</span>
              </p>
            </div>
            <button onClick={handleRemoveCupon} className="text-on-surface-variant hover:text-error transition-colors" title="Quitar cupón">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        )}

        {/* Planes de pago */}
        <div className="mb-10">
          <h2 className="font-headline font-bold uppercase text-xs tracking-widest text-on-surface-variant mb-4">Elegí tu plan de pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planesActivos.map(plan => {
              const monto = getMontoConDescuento(plan, cuponResult);
              const originalMonto = plan.monto;
              const hasDiscount = cuponResult?.valid && plan.ratio !== null && monto !== originalMonto;
              const cashResto = getCashResto(plan);

              return (
                <label
                  key={plan.id}
                  className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${
                    form.plan === plan.id
                      ? `${plan.color} bg-surface-container-high`
                      : 'border-outline-variant/20 bg-surface-container hover:border-outline-variant/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={form.plan === plan.id}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {form.plan === plan.id && (
                    <span className="absolute top-3 right-3 material-symbols-outlined text-sm text-secondary">check_circle</span>
                  )}
                  <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-3 ${plan.badgeColor}`}>{plan.badge}</span>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-xl text-on-surface-variant">{plan.icon}</span>
                    <p className="font-headline font-bold text-sm">{plan.label}</p>
                  </div>

                  {/* Price with optional discount */}
                  <div className="mb-1">
                    {hasDiscount && (
                      <p className="text-xs text-on-surface-variant line-through">${originalMonto.toLocaleString('es-AR')}</p>
                    )}
                    <p className={`font-headline text-2xl font-black ${hasDiscount ? 'text-tertiary' : ''}`}>
                      ${monto.toLocaleString('es-AR')}
                    </p>
                    {cashResto > 0 && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5">+ ${cashResto.toLocaleString('es-AR')} en efectivo el día del inicio</p>
                    )}
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed">{plan.desc}</p>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 card space-y-5 border border-outline-variant/30">
            {CAMPOS.map(campo => (
              <div key={campo.id}>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">{campo.label}</label>
                <input
                  type={campo.type}
                  name={campo.id}
                  required
                  value={form[campo.id]}
                  onChange={handleChange}
                  className="input-field"
                  placeholder={campo.placeholder}
                />
              </div>
            ))}

            {/* Coupon input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Cupón de descuento (opcional)
              </label>
              {cuponResult?.valid ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-tertiary/10 border border-tertiary/30 rounded-xl">
                  <span className="material-symbols-outlined text-tertiary text-sm">local_offer</span>
                  <span className="flex-1 text-sm font-bold text-tertiary uppercase tracking-widest">{cuponResult.cupon.code}</span>
                  <span className="text-xs font-bold text-tertiary">{cuponResult.label}</span>
                  <button type="button" onClick={handleRemoveCupon} className="text-on-surface-variant hover:text-error transition-colors ml-1">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cuponInput}
                    onChange={e => setCuponInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAplicarCupon())}
                    placeholder="CÓDIGO"
                    className="input-field flex-1 uppercase tracking-widest font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleAplicarCupon}
                    disabled={!cuponInput.trim() || cuponLoading}
                    className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl font-headline font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-40 shrink-0"
                  >
                    {cuponLoading ? '...' : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Consulta / Mensaje (opcional)</label>
              <textarea
                name="consulta"
                value={form.consulta}
                onChange={handleChange}
                rows={3}
                className="input-field resize-none"
                placeholder="¿Tenés alguna pregunta?"
              />
            </div>

            {errMsg && (
              <div className="bg-error-container/20 border border-error/30 rounded-lg px-4 py-3 text-sm text-error">{errMsg}</div>
            )}

            <button type="submit" disabled={estado === 'loading'} className="group relative overflow-hidden w-full flex items-center justify-center bg-[#009EE3] hover:bg-[#008ACA] active:bg-[#007EB5] transition-all duration-300 border-none text-white h-[60px] rounded-xl font-bold shadow-[0_8px_24px_rgba(0,158,227,0.3)] hover:shadow-[0_12px_28px_rgba(0,158,227,0.4)] disabled:opacity-75 disabled:cursor-not-allowed">
              <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
              {estado === 'loading' ? (
                <div className="flex items-center justify-center gap-3 relative z-10 w-full">
                  <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                  <span className="text-[17px] tracking-wide font-headline">Procesando pago...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2.5 relative z-10 w-full px-4">
                  <div className="bg-white rounded-full w-[30px] h-[30px] flex items-center justify-center shadow-sm shrink-0">
                    <img src={mpLogo} alt="Icono Mercado Pago" className="w-[18px] h-[18px] object-contain select-none ml-[1px]" />
                  </div>
                  <span className="text-[16px] md:text-[17px] tracking-wide font-headline pt-[1px]">
                    Pagar ${montoEfectivo.toLocaleString('es-AR')} con Mercado Pago
                  </span>
                  <span className="material-symbols-outlined text-white/50 text-xl absolute right-5 hidden md:block" title="Compra Protegida">verified_user</span>
                </div>
              )}
            </button>
          </form>

          {/* Info Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card border border-secondary/30">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Inversión Total</p>
              {cuponResult?.valid ? (
                <>
                  <p className="text-sm text-on-surface-variant line-through">${BASE_TOTAL.toLocaleString('es-AR')} ARS</p>
                  <p className="font-headline text-4xl font-black text-tertiary">${totalConDescuento.toLocaleString('es-AR')}</p>
                  <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest mt-0.5">{cuponResult.label} aplicado</p>
                </>
              ) : (
                <>
                  <p className="font-headline text-4xl font-black mb-1">${BASE_TOTAL.toLocaleString('es-AR')}</p>
                  <p className="text-on-surface-variant text-sm line-through mb-3">$650.000 ARS</p>
                </>
              )}
              <div className="pt-3 border-t border-outline-variant/20 mt-3">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Plan seleccionado</p>
                <p className="text-sm font-bold text-secondary">{planSeleccionado?.label}</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Anticipo MP: <span className="font-bold">${montoEfectivo.toLocaleString('es-AR')}</span>
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="card border border-outline-variant/20 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                Ubicación del Curso
              </p>
              <p className="text-sm font-bold">Soldado Juan Rava 1020</p>
              <p className="text-sm text-on-surface-variant">Esquina Avenida Olavarría — Presencial</p>
              <a
                href="https://maps.app.goo.gl/FmbCU43bg3Ezh5gw9"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs font-bold text-primary hover:underline mt-2"
              >
                <span className="material-symbols-outlined text-sm">map</span>
                Ver en Google Maps
              </a>
            </div>

            {[
              { icon: 'verified', text: 'Certificado al finalizar' },
              { icon: 'support_agent', text: 'Soporte incluido' },
              { icon: 'groups', text: 'Clases presenciales' },
              { icon: 'cloud_download', text: 'Material descargable' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-secondary text-xl">{item.icon}</span>
                <span className="font-bold">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
