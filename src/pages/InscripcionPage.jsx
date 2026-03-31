import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const WAPP = '5491162020911';
const WAPP_MSG = encodeURIComponent('Hola! Quiero inscribirme al curso de moldería con Audaces. Me gustaría recibir más información.');

const CAMPOS = [
  { id: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Ana' },
  { id: 'apellido', label: 'Apellido', type: 'text', placeholder: 'García' },
  { id: 'email', label: 'Email', type: 'email', placeholder: 'ana@ejemplo.com' },
  { id: 'telefono', label: 'WhatsApp / Teléfono', type: 'tel', placeholder: '+54 11 0000-0000' },
];

const PLANES = [
  {
    id: 'completo_mp',
    label: 'Pago Completo — MercadoPago',
    monto: 400000,
    badge: 'Recomendado',
    badgeColor: 'bg-secondary/20 text-secondary',
    desc: 'Pagá $400.000 completo por MercadoPago (transferencia, tarjeta, débito).',
    icon: 'credit_card',
    color: 'border-secondary',
  },
  {
    id: 'anticipo_50',
    label: 'Anticipo 50% — MercadoPago',
    monto: 200000,
    badge: '+ $200.000 efectivo',
    badgeColor: 'bg-primary/20 text-primary',
    desc: 'Pagá $200.000 ahora por MercadoPago y $200.000 en efectivo el día del inicio.',
    icon: 'payments',
    color: 'border-primary',
  },
  {
    id: 'anticipo_25',
    label: 'Anticipo 25% — MercadoPago',
    monto: 100000,
    badge: '+ $300.000 efectivo',
    badgeColor: 'bg-tertiary/20 text-tertiary',
    desc: 'Pagá $100.000 ahora por MercadoPago y $300.000 en efectivo el día del inicio.',
    icon: 'account_balance_wallet',
    color: 'border-tertiary',
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
  },
];

export default function InscripcionPage() {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', plan: 'completo_mp', consulta: '' });
  const [comprobante, setComprobante] = useState(null);
  const [estado, setEstado] = useState('idle');
  const [errMsg, setErrMsg] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const planSeleccionado = PLANES.find(p => p.id === form.plan);

  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isUrlTest = params.get('test') === 'true';

    // Intentamos traerlo de DB (si falla por permisos RLS o red, no rompe)
    supabase.from('app_settings').select('value').eq('id', 'test_mode_mp').single().then(({data, error}) => {
      if (data?.value === true || isUrlTest) {
        setTestMode(true);
      } else {
        if (form.plan === 'prueba_100') setForm(prev => ({...prev, plan: 'completo_mp'}));
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

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado('loading');
    setErrMsg('');
    try {
      // 1. Crear el usuario en Supabase
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: Math.random().toString(36).slice(-10) + 'A1!',
        options: {
          data: { nombre: form.nombre, apellido: form.apellido, telefono: form.telefono, rol: 'estudiante' },
        },
      });
      if (authErr && !authErr.message.includes('already registered')) throw authErr;

      const userId = authData?.user?.id || (await supabase.auth.getUser()).data?.user?.id;

      // 2. Pedirle la Preferencia a nuestro servidor Node (Vercel)
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer_email: form.email,
          items: [{
            title: `Inscripción Curso Presencial - ${planSeleccionado?.label}`,
            unit_price: planSeleccionado?.monto || 400000,
            quantity: 1,
            currency_id: 'ARS'
          }]
        })
      });

      const mpData = await res.json();
      if (!res.ok) throw new Error(mpData.error || 'Error al generar link de pago');

      // 3. Registrar el pago PENDIENTE en la base de datos
      if (userId) {
        await supabase.from('pagos').insert({
          estudiante_id: userId,
          monto: planSeleccionado?.monto || 400000,
          moneda: 'ARS',
          metodo_pago: 'mercadopago',
          estado: 'pendiente',
          concepto: `Inscripción Curso Moldería — ${planSeleccionado?.label}`,
          notas: `Preferencia MP: ${mpData.id} | Consulta del alumno: ${form.consulta}`,
        });
      }

      // 4. Redirigir agresivamente a MercadoPago Seguro
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
            Este es un <strong>curso 100% presencial</strong>. Elegí tu plan de pago, completá el formulario y completá tu pago online para confirmar tu inscripción.
          </p>
        </div>

        {/* Planes de pago */}
        <div className="mb-10">
          <h2 className="font-headline font-bold uppercase text-xs tracking-widest text-on-surface-variant mb-4">Elegí tu plan de pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planesActivos.map(plan => (
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
                <p className="font-headline text-2xl font-black mb-1">${plan.monto.toLocaleString('es-AR')}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{plan.desc}</p>
              </label>
            ))}
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

            {/* Eliminamos el bloque viejo de adjuntar comprobante */}

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

            <button type="submit" disabled={estado === 'loading'} className="btn-primary w-full flex items-center justify-center gap-2 bg-[#009EE3] hover:bg-[#008ACA] border-none text-white h-14 rounded-xl font-bold shadow-lg shadow-[#009EE3]/20">
              {estado === 'loading'
                ? <><span className="material-symbols-outlined text-sm" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>Generando pago seguro...</>
                : <>Pagar con MercadoPago<span className="material-symbols-outlined text-sm">lock</span></>
              }
            </button>
          </form>

          {/* Info Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card border border-secondary/30">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Inversión Total</p>
              <p className="font-headline text-4xl font-black mb-1">$400.000</p>
              <p className="text-on-surface-variant text-sm line-through mb-3">$650.000 ARS</p>
              <div className="pt-3 border-t border-outline-variant/20">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Plan seleccionado</p>
                <p className="text-sm font-bold text-secondary">{planSeleccionado?.label}</p>
                <p className="text-xs text-on-surface-variant mt-1">Anticipo: <span className="font-bold">${planSeleccionado?.monto.toLocaleString('es-AR')}</span></p>
              </div>
            </div>

            {/* Ubicación */}
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
