import React, { useState } from 'react';
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
      if (authErr) throw authErr;

      let comprobante_url = null;
      if (comprobante && authData.user) {
        const ext = comprobante.name.split('.').pop();
        const path = `${authData.user.id}/inscripcion_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, comprobante);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path);
          comprobante_url = urlData?.publicUrl || null;
        }
      }

      if (authData.user) {
        await supabase.from('pagos').insert({
          estudiante_id: authData.user.id,
          monto: planSeleccionado?.monto || 400000,
          moneda: 'ARS',
          metodo_pago: 'mercadopago',
          estado: 'pendiente',
          concepto: `Inscripción Curso Moldería — ${planSeleccionado?.label}`,
          comprobante_url,
          notas: form.consulta,
        });
      }

      setEstado('success');
    } catch (err) {
      setEstado('error');
      setErrMsg(err.message || 'Ocurrió un error. Intenta de nuevo.');
    }
  }

  if (estado === 'success') {
    const wappSuccessMsg = encodeURIComponent(
      `Hola! Acabo de completar mi inscripción al curso de moldería.\nNombre: ${form.nombre} ${form.apellido}\nEmail: ${form.email}\nPlan elegido: ${planSeleccionado?.label}\n\nAdjunto mi comprobante de pago. ¡Gracias!`
    );
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-secondary text-6xl">check_circle</span>
          <h2 className="font-headline text-3xl font-bold mt-4 mb-3">¡Inscripción enviada!</h2>
          <p className="text-on-surface-variant mb-8">
            Recibimos tu solicitud. Ahora enviá tu comprobante de pago por WhatsApp para confirmar tu lugar.
          </p>
          <a
            href={`https://wa.me/${WAPP}?text=${wappSuccessMsg}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex items-center gap-3 text-lg px-8 py-4"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar comprobante por WhatsApp
          </a>
          <p className="text-xs text-on-surface-variant mt-4 uppercase tracking-widest">+54 11 6202-0911</p>
        </div>
      </div>
    );
  }

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
            Este es un <strong>curso 100% presencial</strong>. Elegí tu plan de pago, completá el formulario y enviá tu comprobante por WhatsApp para confirmar tu inscripción.
          </p>
        </div>

        {/* Planes de pago */}
        <div className="mb-10">
          <h2 className="font-headline font-bold uppercase text-xs tracking-widest text-on-surface-variant mb-4">Elegí tu plan de pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANES.map(plan => (
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

            {/* Comprobante info */}
            <div className="bg-surface-variant rounded-xl p-4 border border-outline-variant/20">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-secondary"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviá el comprobante por WhatsApp
              </p>
              <p className="text-sm text-on-surface-variant">
                Luego de pagar por MercadoPago, enviá el comprobante al <span className="font-bold text-on-surface">+54 11 6202-0911</span> para confirmar tu lugar.
              </p>
              <a
                href={`https://wa.me/${WAPP}?text=${WAPP_MSG}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-secondary hover:underline"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar por WhatsApp ahora
              </a>
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

            <button type="submit" disabled={estado === 'loading'} className="btn-primary w-full flex items-center justify-center gap-2">
              {estado === 'loading'
                ? <><span className="material-symbols-outlined text-sm" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>Enviando...</>
                : <><span className="material-symbols-outlined text-sm">send</span>Enviar Inscripción</>
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
