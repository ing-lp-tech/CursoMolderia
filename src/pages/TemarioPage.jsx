import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const MODULOS = [
  {
    num: '01',
    titulo: 'Introducción y Configuración del Software',
    icon: 'settings',
    color: 'text-primary',
    secciones: [
      {
        sub: '1.1',
        titulo: 'Presentación del software y su interfaz',
        items: ['Presentación de la interfaz y ubicación de las herramientas'],
      },
      {
        sub: '1.2',
        titulo: 'Configuración inicial del software',
        items: [
          'Configuración de la interfaz',
          'Configuración de unidades de medidas',
          'Back Up — copia de seguridad automática',
          'Tamaño de texto y medida de piquetes',
          'Configuración del GRID o Cuadrícula',
          'Configurar botón SNAP y menú de coordenadas',
        ],
      },
      {
        sub: '1.3',
        titulo: 'Funciones del Mouse y Botón SNAP',
        items: [
          'Manejo del Mouse en la interfaz del software',
          'Manejo del botón SNAP y usos frecuentes',
        ],
      },
    ],
  },
  {
    num: '02',
    titulo: 'Herramientas Básicas — Dibujos, Trazos y Texto',
    icon: 'draw',
    color: 'text-secondary',
    secciones: [
      {
        sub: '2.1',
        titulo: 'Rectas',
        items: [
          'Crear rectas y rectángulos',
          'Recta dado un elemento y el ángulo',
          'Prolongar recta hasta el elemento',
          'Prolongar 2 rectas',
        ],
      },
      {
        sub: '2.2',
        titulo: 'Curvas',
        items: ['Crear curvas', 'Dividir curvas', 'Insertar curva predefinida', 'Editar curvas'],
      },
      {
        sub: '2.3',
        titulo: 'Puntos',
        items: [
          'Crear puntos por coordenadas',
          'Punto en el centro del arco',
          'Puntos en el perímetro del elemento',
          'Punto de intersección de 2 elementos',
        ],
      },
      {
        sub: '2.4',
        titulo: 'Cotas',
        items: ['Perímetro de un elemento', 'Distancia entre dos puntos', 'Cota perímetro', 'Cota de una distancia'],
      },
      {
        sub: '2.5',
        titulo: 'Arcos (círculos)',
        items: ['Arco definido por su centro', 'Arco dado 2 puntos', 'Arco dado 3 puntos'],
      },
      {
        sub: '2.6',
        titulo: 'Texto',
        items: ['Crear texto', 'Modificar texto'],
      },
      {
        sub: '⭐',
        titulo: 'MASTER: Creación de Moldes por Coordenadas',
        items: ['Creación de moldería completa mediante puntos de coordenadas usando todas las herramientas básicas (Remera Básica)'],
        highlight: true,
      },
    ],
  },
  {
    num: '03',
    titulo: 'Herramientas Avanzadas — Vectorización de Patrones',
    icon: 'architecture',
    color: 'text-tertiary',
    secciones: [
      {
        sub: '3.1',
        titulo: 'Vectorización y Configuración de Patrones',
        items: [
          'Crear patrones por intersección (Vectorizar)',
          'Configuración: nombre, tipo de tela, rotación, cantidad por modelo, doblez horizontal/vertical',
          'Definir la curva de talles',
          'Visualización de elementos dentro del patrón',
          'Definir márgenes de patrón (sublimado / estampado)',
        ],
      },
      {
        sub: '3.2',
        titulo: 'Herramientas de Definición',
        items: [
          'Definir sentido de hilo',
          'Dar margen de costura',
          'Desdoblar / doblar patrones',
          'Cortar patrones / unir patrones',
          'Comparar medidas entre patrones',
          'Crear dobladillos (ruedos)',
        ],
      },
      {
        sub: '3.3',
        titulo: 'Herramientas de Transformación',
        items: [
          'Crear pinzas en el patrón',
          'Transferencia de pinzas',
          'Alinear puntos del patrón',
          'Adicionar / eliminar puntos de control',
          'Separar elementos del patrón',
          'Adicionar o borrar líneas auxiliares dentro del patrón',
          'Tablas simples y dobles',
        ],
      },
      {
        sub: '3.4',
        titulo: 'Herramientas de Edición — Piquetes',
        items: ['Insertar piquetes', 'Modificar piquetes', 'Eliminar piquetes', 'Alinear piquetes'],
      },
      {
        sub: '3.5',
        titulo: 'Herramientas de Manipulación de Patrones',
        items: [
          'Mover / copiar / girar elementos',
          'Ampliar o reducir elementos',
          'Reflejar y modificar elementos',
          'Redefinir perímetro de elementos',
          'Crear elemento paralelo',
          'Manipulación rápida',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER CLASS: Pantalón Recto',
        items: ['Creación de patrones mediante coordenadas usando todas las herramientas básicas y avanzadas'],
        highlight: true,
      },
    ],
  },
  {
    num: '04',
    titulo: 'Desarrollo de Patrones Base',
    icon: 'style',
    color: 'text-primary',
    secciones: [
      {
        sub: '4.1',
        titulo: 'Introducción a la moldería base',
        items: ['Conceptos fundamentales de moldería digital', 'Estudio de proporciones y medidas estándar'],
      },
      {
        sub: '4.2',
        titulo: 'Construcción de Moldes Base paso a paso',
        items: [
          'Base corpiño (blusa) Dama',
          'Base manga corta, larga y manga 3/4',
          'Base pantalón',
          'Base falda',
          'Base cuerpo completo',
        ],
      },
    ],
  },
  {
    num: '05',
    titulo: 'Interpretación de Diseños con Moldería Base',
    icon: 'checkroom',
    color: 'text-secondary',
    secciones: [
      {
        sub: '5.1–5.5',
        titulo: 'Interpretación de prendas completas',
        items: [
          'Interpretación de Camisa',
          'Interpretación de Pantalón',
          'Interpretación de Vestido',
          'Interpretación de Falda',
          'Interpretación de Short',
        ],
      },
    ],
  },
  {
    num: '06',
    titulo: 'Progresión y Escalado de Moldes',
    icon: 'straighten',
    color: 'text-tertiary',
    secciones: [
      {
        sub: '6.1',
        titulo: 'Introducción al escalado',
        items: ['Conceptos de progresión de talles', 'Tabla de talles argentina e internacional'],
      },
      {
        sub: '6.2–6.6',
        titulo: 'Progresión por prenda',
        items: [
          'Progresión de Camisa',
          'Progresión de Pantalón',
          'Progresión de Vestido',
          'Progresión de Falda',
          'Progresión de Short',
        ],
      },
    ],
  },
  {
    num: '07',
    titulo: 'Audaces Tizada — Optimización de Recursos en Corte',
    icon: 'grid_4x4',
    color: 'text-primary',
    secciones: [
      {
        sub: '7.1',
        titulo: 'Presentación de Audaces Tizada',
        items: ['Vista previa de la interfaz y sus herramientas'],
      },
      {
        sub: '7.2',
        titulo: 'Creación de Tizadas',
        items: [
          'Agregar diseños para tizadas automáticas',
          'Agregar 2 o más diseños en la misma tizada',
          'Tizadas en diseños combinados (forrería, entretela, fliselina)',
        ],
      },
      {
        sub: '7.3',
        titulo: 'Opciones Avanzadas',
        items: [
          'Mantener piezas ajustadas',
          'Usar solamente piezas ajustadas',
          'Mantener grupos de piezas',
          'Mantener orientación de los paquetes',
        ],
      },
      {
        sub: '7.4',
        titulo: 'Tizadas para Telas Tubulares',
        items: ['Configurar patrones para tizadas en tubulares'],
      },
      {
        sub: '7.5 ★',
        titulo: 'BONO EXTRA dentro del módulo',
        items: [
          'Herramienta: Puntos de Corrección (empalmes)',
          'Margen de seguridad entre patrones (estampado/sublimado)',
          'Destacar patrones en tizada (verificación de paquetes)',
        ],
        highlight: true,
      },
    ],
  },
  {
    num: '08',
    titulo: 'Digiflash — Digitalización Profesional de Moldes Físicos',
    icon: 'document_scanner',
    color: 'text-secondary',
    secciones: [
      {
        sub: '8.1',
        titulo: 'Introducción a la pizarra digitalizadora',
        items: [
          'Presentación del hardware y software Digiflash',
          'Configuración de los moldes sobre la pizarra digitalizadora',
        ],
      },
      {
        sub: '8.2',
        titulo: 'Digitalización precisa de moldes físicos',
        items: [
          'Digitalización Automática',
          'Digitalización Manual con herramientas del software',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER CLASS COMPLETA',
        items: ['Digitalización de moldes en cartón con Digiflash — de 0 hasta la creación de una tizada completa'],
        highlight: true,
      },
    ],
  },
  {
    num: '09',
    titulo: 'Proyecto Final + Certificación',
    icon: 'military_tech',
    color: 'text-tertiary',
    secciones: [
      {
        sub: '9.1',
        titulo: 'Proyecto integrador',
        items: [
          'Desarrollo de una prenda completa desde cero (idea → molde → escalado → tizada)',
          'Revisión de errores comunes',
          'Feedback personalizado con el docente',
          'Entrega final y obtención del certificado del curso',
        ],
      },
    ],
  },
];

const BONOS = [
  {
    num: '#1',
    titulo: 'SOFTWARE Audaces 7.5 + Guía de Instalación',
    desc: 'Accedé al software oficial Audaces Vestuario 7.5 con guía paso a paso para instalarlo correctamente en tu equipo.',
    icon: 'download',
    tag: 'GRATIS',
  },
  {
    num: '#2',
    titulo: 'Pack de +500 Moldes Digitales',
    desc: 'Más de 500 moldes digitales listos para personalizar y usar como punto de partida en tus proyectos.',
    icon: 'folder_open',
    tag: 'GRATIS',
  },
  {
    num: '#3',
    titulo: 'Mockups Vectoriales — +200 Figurines',
    desc: 'Más de 200 figurines vectorizados totalmente personalizables en formato CDR para crear fichas técnicas profesionales.',
    icon: 'design_services',
    tag: 'GRATIS',
  },
];

export default function TemarioPage() {
  const [open, setOpen] = useState(null);

  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="badge-secondary mb-4">Plan de Estudios</span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight mt-4 mb-6">
            Lo que vas a <span className="gradient-text">dominar</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
            Programa completo de <strong>9 módulos</strong> del Curso Audaces Vestuario 7.5, con Master Classes integradas y 3 bonos exclusivos.
          </p>
        </div>

        {/* Stats + Inicio */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { val: '9', label: 'Módulos', color: 'text-secondary' },
            { val: '100%', label: 'Presencial', color: 'text-primary' },
            { val: '3', label: 'Bonos Gratis', color: 'text-tertiary' },
            { val: '13 Mar', label: 'Inicio', color: 'text-error' },
          ].map(({ val, label, color }) => (
            <div key={label} className="card text-center border border-outline-variant/20">
              <p className={`font-headline text-3xl font-black ${color}`}>{val}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Accordion de módulos */}
        <div className="space-y-3 mb-20">
          {MODULOS.map((m, i) => (
            <div
              key={m.num}
              className={`rounded-xl border transition-all duration-300 ${
                open === i
                  ? 'border-primary/40 bg-surface-container-high'
                  : 'border-outline-variant/20 bg-surface-container hover:border-outline-variant/40'
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left"
              >
                <span className={`material-symbols-outlined ${m.color} shrink-0`}>{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-label text-xs font-bold uppercase tracking-widest ${m.color}`}>
                    Módulo {m.num}
                  </span>
                  <h3 className="font-headline font-bold text-base md:text-lg mt-0.5 leading-snug">{m.titulo}</h3>
                </div>
                <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 shrink-0 ${open === i ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {open === i && (
                <div className="px-6 pb-6 border-t border-outline-variant/20 pt-5 space-y-5">
                  {m.secciones.map((sec) => (
                    <div key={sec.sub} className={`rounded-xl p-4 ${sec.highlight ? 'bg-primary/5 border border-primary/20' : 'bg-surface-variant/30'}`}>
                      <p className={`font-label text-[10px] font-black uppercase tracking-widest mb-2 ${sec.highlight ? m.color : 'text-on-surface-variant'}`}>
                        {sec.highlight ? '★ ' : ''}{sec.sub} · {sec.titulo}
                      </p>
                      <ul className="space-y-1.5">
                        {sec.items.map(item => (
                          <li key={item} className="flex items-start gap-2.5 text-on-surface-variant text-sm leading-relaxed">
                            <span className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${m.color}`}>
                              {sec.highlight ? 'star' : 'check_circle'}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bonos */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <span className="badge-primary mb-3">Incluido en tu inscripción</span>
            <h2 className="font-headline text-3xl font-bold mt-4">3 Bonos Exclusivos</h2>
            <p className="text-on-surface-variant mt-2">Todo lo que necesitás para arrancar desde el primer día.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BONOS.map(b => (
              <div key={b.num} className="card border border-outline-variant/20 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                <div className="absolute top-3 right-3">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">
                    {b.tag}
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-3xl mb-4">{b.icon}</span>
                <p className="font-label text-[10px] font-black uppercase tracking-widest text-primary mb-1">Bono {b.num}</p>
                <h3 className="font-headline font-bold text-base mb-3 leading-snug">{b.titulo}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-surface-container border border-outline-variant/20 rounded-2xl p-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error/10 border border-error/30">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="text-error font-label text-[10px] uppercase tracking-[0.2em] font-bold">Inicio: 13 de Marzo · Cupos Limitados</span>
          </div>
          <h2 className="font-headline text-3xl font-bold">¿Listo para empezar?</h2>
          <p className="text-on-surface-variant max-w-md mx-auto">
            9 módulos + 3 bonos + certificación profesional. Todo por <strong className="text-on-surface">$400.000 ARS</strong>.
          </p>
          <Link to="/inscripcion" className="btn-primary inline-flex items-center gap-2">
            <span className="material-symbols-outlined">rocket_launch</span>
            Inscribirme Ahora
          </Link>
        </div>

      </div>
    </div>
  );
}
