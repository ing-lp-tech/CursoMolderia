import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const MODULOS = [
  {
    num: '01', titulo: 'Introducción y Configuración de Software',
    items: ['Instalación y activación de Audaces', 'Configuración del entorno de trabajo', 'Tour por la interfaz y herramientas esenciales', 'Primeras pruebas en el software'],
    icon: 'settings', color: 'text-primary',
  },
  {
    num: '02', titulo: 'Herramientas Básicas y Avanzadas',
    items: ['Herramientas de dibujo y edición', 'Líneas, curvas y puntos de control', 'Transformaciones de piezas', 'Funciones avanzadas de edición'],
    icon: 'build', color: 'text-secondary',
  },
  {
    num: '03', titulo: 'Desarrollo de Patrones Base',
    items: ['Molde base de cuerpo y manga', 'Molde base de pantalón y falda', 'Construcción con medidas estándar', 'Ajustes y correcciones del patrón'],
    icon: 'architecture', color: 'text-tertiary',
  },
  {
    num: '04', titulo: 'Interpretación de Diseños con Moldería Base',
    items: ['Lectura e interpretación de fichas técnicas', 'Transformaciones a partir de moldes base', 'Pinzas, cortes y escotes', 'Mangas y detalles de diseño'],
    icon: 'style', color: 'text-primary',
  },
  {
    num: '05', titulo: 'Progresión y Escalado de Moldes',
    items: ['Tabla de talles argentina e internacional', 'Escalado automático por gradación', 'Verificación de curvas de crecimiento', 'Exportación de tallas'],
    icon: 'straighten', color: 'text-secondary',
  },
  {
    num: '06', titulo: 'Audaces Tizada — Optimización de Recursos en Corte',
    items: ['Organización eficiente de piezas', 'Optimización del consumo de tela', 'Configuración de parámetros de corte', 'Exportación a PDF y plotter industrial'],
    icon: 'grid_4x4', color: 'text-tertiary',
  },
  {
    num: '07', titulo: 'Digiflash — Digitalización Profesional de Moldes Físicos',
    items: ['Introducción a Digiflash', 'Proceso de digitalización de moldes en papel', 'Corrección y limpieza de moldes digitalizados', 'Integración con Audaces CAD'],
    icon: 'document_scanner', color: 'text-primary',
  },
  {
    num: '08', titulo: 'Proyecto Final + Certificación',
    items: ['Diseño completo de una prenda a elección', 'Escalado y tizada profesional', 'Revisión y feedback personalizado', 'Entrega y certificación del curso'],
    icon: 'military_tech', color: 'text-secondary',
  },
];

export default function TemarioPage() {
  const [open, setOpen] = useState(null);

  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="badge-secondary mb-4">Plan de Estudios</span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight mt-4 mb-6">
            Lo que vas a <span className="gradient-text">dominar</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
            Un programa de 8 módulos diseñado para llevarte de cero a profesional en Audaces.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 mb-16 max-w-sm mx-auto">
          {[['8', 'Módulos'], ['100%', 'Presencial']].map(([val, label]) => (
            <div key={label} className="card text-center">
              <p className="font-headline text-3xl md:text-4xl font-black text-secondary">{val}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {MODULOS.map((m, i) => (
            <div
              key={m.num}
              className={`rounded-xl border transition-all duration-300 ${open === i ? 'border-primary/40 bg-surface-container-high' : 'border-outline-variant/20 bg-surface-container hover:border-outline-variant/40'}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left"
              >
                <span className={`material-symbols-outlined ${m.color}`}>{m.icon}</span>
                <div className="flex-1">
                  <span className={`font-label text-xs font-bold uppercase tracking-widest ${m.color}`}>Módulo {m.num}</span>
                  <h3 className="font-headline font-bold text-base md:text-lg mt-0.5">{m.titulo}</h3>
                </div>
                <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {open === i && (
                <div className="px-6 pb-6 border-t border-outline-variant/20 pt-4">
                  <ul className="space-y-2">
                    {m.items.map(item => (
                      <li key={item} className="flex items-center gap-3 text-on-surface-variant text-sm">
                        <span className={`material-symbols-outlined text-sm ${m.color}`}>check_circle</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Link to="/inscripcion" className="btn-primary inline-flex items-center gap-2">
            <span className="material-symbols-outlined">rocket_launch</span>
            Comenzar Ahora — $400.000
          </Link>
        </div>
      </div>
    </div>
  );
}
