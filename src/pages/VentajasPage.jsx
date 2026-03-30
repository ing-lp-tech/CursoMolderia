import React from 'react';
import { Link } from 'react-router-dom';

const VENTAJAS = [
  { icon: 'cloud_done', title: 'Cero Espacio Físico', desc: 'Miles de molderías almacenadas en la nube, organizadas y accesibles instantáneamente.', color: 'text-secondary', span: 'md:col-span-2' },
  { icon: 'biotech', title: '100% Precisión Algorítmica', desc: 'Cálculos matemáticos de Audaces que garantizan un calce perfecto siempre.', color: 'text-primary', span: '' },
  { icon: 'rocket_launch', title: 'Escalado Automático', desc: 'Modificaciones estructurales y progresiones de talles completas en segundos.', color: 'text-tertiary', span: '' },
  { icon: 'savings', title: '25% Ahorro de Material', desc: 'La tizada optimizada reduce el desperdicio textil, impactando tus márgenes de ganancia.', color: 'text-secondary', span: 'md:col-span-2' },
  { icon: 'verified', title: 'Certificación Oficial', desc: 'Recibe un certificado que acredita tu dominio de Audaces ante la industria.', color: 'text-primary', span: '' },
  { icon: 'support_agent', title: 'Soporte de por Vida', desc: 'Acceso permanente a actualizaciones del curso y comunidad de estudiantes.', color: 'text-tertiary', span: '' },
];

const COMPARACION = {
  viejo: [
    { icon: 'warning', label: 'Espacio Físico Masivo', desc: 'Archivadores llenos de moldes que se deterioran.' },
    { icon: 'ink_eraser', label: 'Margen de Error Humano', desc: 'Inconsistencias milimétricas del trazo manual.' },
    { icon: 'timer_off', label: 'Escalado Lento', desc: 'Horas de trabajo manual repetitivo por cada talle.' },
  ],
  nuevo: [
    { icon: 'cloud_done', label: 'Cero Espacio Físico', desc: 'Todo en la nube, organizado e instantáneo.' },
    { icon: 'biotech', label: 'Precisión Total', desc: 'Algoritmos que garantizan calce perfecto.' },
    { icon: 'rocket_launch', label: 'Escalado en Segundos', desc: 'Automatización completa de gradaciones.' },
  ],
};

export default function VentajasPage() {
  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="badge-primary mb-4">Evolución Técnica</span>
          <h1 className="font-headline text-4xl md:text-7xl font-black tracking-tighter mt-4 mb-6 uppercase">
            Moldería con Audaces{' '}
            <span className="text-outline-variant">vs.</span>{' '}
            <br /><span className="gradient-text">Cartón Manual</span>
          </h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
            La transición al atelier digital no es solo una mejora; es una redefinición total de la eficiencia productiva.
          </p>
        </div>

        {/* Comparación */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-24">
          <div className="lg:col-span-5 bg-surface-container-low p-8 rounded-xl border-l-4 border-outline/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-[200px]">history</span>
            </div>
            <h3 className="text-outline font-headline font-bold text-xl mb-8 uppercase tracking-widest">Cartón Manual</h3>
            <ul className="space-y-6">
              {COMPARACION.viejo.map(item => (
                <li key={item.label} className="flex items-start gap-4 opacity-60">
                  <span className="material-symbols-outlined text-error pt-1">{item.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 flex items-center justify-center py-8">
            <div className="bg-surface-container-highest p-4 rounded-full border border-secondary/20">
              <span className="material-symbols-outlined text-secondary text-3xl">bolt</span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-surface-container-high p-8 rounded-xl border-l-4 border-secondary relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary/5 blur-[80px] rounded-full" />
            <h3 className="text-secondary font-headline font-bold text-xl mb-8 uppercase tracking-widest">Audaces Digital</h3>
            <ul className="space-y-6">
              {COMPARACION.nuevo.map(item => (
                <li key={item.label} className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary pt-1">{item.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bento Ventajas */}
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tight mb-12">Ventajas del ADN Digital</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {VENTAJAS.map(v => (
            <div key={v.title} className={`card-hover ${v.span}`}>
              <span className={`material-symbols-outlined text-4xl mb-4 ${v.color}`}>{v.icon}</span>
              <h4 className="font-headline text-xl font-bold mb-2">{v.title}</h4>
              <p className="text-on-surface-variant text-sm">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Progress bars */}
        <div className="card mb-20">
          <h4 className="text-sm font-bold font-headline mb-6 uppercase tracking-widest text-outline">Progreso Técnico</h4>
          {[
            { label: 'Precisión Digital (Audaces)', val: 100, color: 'bg-secondary' },
            { label: 'Carga de Trabajo Manual', val: 85, color: 'bg-error/50' },
          ].map(b => (
            <div key={b.label} className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold">{b.label}</span>
                <span className="text-xs text-secondary">{b.val}%</span>
              </div>
              <div className="h-1.5 w-full bg-outline-variant/20 rounded-full overflow-hidden">
                <div className={`h-full ${b.color}`} style={{ width: `${b.val}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-surface-container-highest p-12 rounded-xl relative overflow-hidden border border-primary/20 text-center">
          <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
          <span className="badge-error mb-6 inline-block">Solo quedan pocos cupos</span>
          <h2 className="font-headline text-4xl md:text-5xl font-black mb-4 tracking-tighter">Inicia tu transformación</h2>
          <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Domina las herramientas que las grandes marcas usan para optimizar sus procesos.</p>
          <Link to="/inscripcion" className="btn-primary inline-flex items-center gap-2 text-lg px-12 py-5">
            RESERVAR VACANTE — $400.000
          </Link>
        </div>
      </div>
    </div>
  );
}
