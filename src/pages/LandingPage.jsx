import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import luisBlack from '../assets/luisBlack.png';
import cristian from '../assets/cristian.jpg';
import logo from '../assets/logo.png';
import { getActiveFlashPromo } from '../utils/cupones';

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!targetDate) return;
    function calc() {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) return setTimeLeft(null);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return timeLeft;
}

function FlashPromoBanner({ promo }) {
  const timeLeft = useCountdown(promo?.expiresAt);
  if (!promo || !timeLeft) return null;

  const pad = n => String(n).padStart(2, '0');
  const discountLabel =
    promo.type === 'percentage'
      ? `${promo.value}% de descuento`
      : `$${Number(promo.value).toLocaleString('es-AR')} de descuento`;

  return (
    <div className="w-full bg-gradient-to-r from-tertiary/20 via-tertiary/10 to-primary/20 border-b border-tertiary/30 px-4 py-2.5 flex flex-wrap items-center justify-center gap-3 text-center z-20 relative">
      <span className="text-tertiary text-sm font-black animate-pulse">⚡ PROMO FLASH</span>
      <span className="text-on-surface text-sm font-bold">{discountLabel}</span>
      {promo.description && (
        <span className="text-on-surface-variant text-xs hidden sm:inline">— {promo.description}</span>
      )}
      <div className="flex items-center gap-1 font-headline font-black text-sm">
        <span className="bg-tertiary/20 text-tertiary rounded px-2 py-0.5">{pad(timeLeft.h)}h</span>
        <span className="text-on-surface-variant">:</span>
        <span className="bg-tertiary/20 text-tertiary rounded px-2 py-0.5">{pad(timeLeft.m)}m</span>
        <span className="text-on-surface-variant">:</span>
        <span className="bg-tertiary/20 text-tertiary rounded px-2 py-0.5">{pad(timeLeft.s)}s</span>
      </div>
      <Link
        to={`/inscripcion?cupon=${promo.code}`}
        className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-tertiary/20 text-tertiary border border-tertiary/40 hover:bg-tertiary/30 transition-all"
      >
        Usar código: {promo.code}
      </Link>
    </div>
  );
}

export default function LandingPage() {
  const [flashPromo, setFlashPromo] = useState(null);

  useEffect(() => {
    getActiveFlashPromo().then(setFlashPromo).catch(() => {});
    // Refresh every 2 minutes
    const id = setInterval(() => getActiveFlashPromo().then(setFlashPromo).catch(() => {}), 120000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative pt-16">
      <FlashPromoBanner promo={flashPromo} />
      {/* Hero */}
      <section className="relative min-h-[795px] flex items-center overflow-hidden px-6 lg:px-20">
        <div className="absolute inset-0 z-0" style={{ backgroundImage: 'linear-gradient(#484847 0.5px, transparent 0.5px), linear-gradient(90deg, #484847 0.5px, transparent 0.5px)', backgroundSize: '40px 40px', opacity: 0.1 }} />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full z-0" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background to-transparent z-0" />

        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-secondary font-label text-[10px] uppercase tracking-[0.2em] font-bold">Inscripciones Abiertas</span>
            </div>

            <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight leading-[0.9]">
              Curso Presencial de{' '}
              <span className="inline-flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary-container">
                Audaces
                <img src="https://audaces.com/wp-content/uploads/2022/05/logo-audace-1.png" alt="Audaces logo" className="h-[40px] md:h-[60px] object-contain aspect-square mix-blend-screen" />
              </span><br />
              Moldería Profesional
            </h1>

            <p className="font-body text-on-surface-variant text-lg md:text-xl max-w-xl leading-relaxed">
              Domina Audaces y el arte de la construcción de patrones digitales en nuestro <strong>curso 100% presencial</strong>. Aprende técnicas avanzadas directamente en el taller.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
              <div className="p-6 bg-surface-container border-l-4 border-secondary rounded-lg shadow-2xl">
                <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest block mb-1">Precio Especial</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-headline font-bold">$400.000</span>
                  <span className="text-on-surface-variant line-through text-sm">$650.000</span>
                </div>
              </div>
              <div className="space-y-3">
                <Link to="/inscripcion" className="btn-primary block text-center">Inscríbete Ahora</Link>
                <p className="text-error font-label text-[10px] uppercase tracking-tighter text-center font-bold">
                  Únete antes de que se agoten los cupos
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative rounded-xl overflow-hidden border border-outline-variant/15 shadow-2xl">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB06807Lx5qzZwLDyGP9g4gYgk9aVch71b8R9TKTLYdRnjzhPruKG6phBBMuh6ei6nwA3jKpWuYoCdQEJaHCw2VzmCsvGJ6qAjTMCp-VLGxkwvxX5U7sJdIEOdqTeDr9t-ieHMk-kB4LhFhDKT2J1h7lDimP3x-5JZKzl4A-Xlf0TLsO0XoFz9Ox0QpNKZfqssgk5j_BKaWuXMBvMWeoh4o3hJHiy5zjbQkysMQxvVHAvaYbB4KZPadzFJf3Nku9hYeTmG6J1kg064"
                alt="Proceso de moldería digital en Audaces"
                className="w-full h-[500px] object-cover opacity-80 hover:opacity-100 transition-opacity duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-surface/80 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 p-4 glass-panel rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-label text-[10px] text-secondary uppercase tracking-widest">Estado del Sistema</span>
                  <span className="font-label text-[10px] text-on-surface-variant">V 2.0.4</span>
                </div>
                <div className="w-full h-[2px] bg-outline-variant/30 relative">
                  <div className="absolute top-0 left-0 h-full w-[15%] bg-secondary shadow-[0_0_8px_#00e3fd]" />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-label text-[10px] text-on-surface-variant uppercase">Estudiantes Inscriptos</span>
                  <span className="font-label text-[10px] text-secondary font-bold">+120</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="py-24 px-6 lg:px-20 bg-surface-container-low">
        <div className="container mx-auto">
          <div className="mb-16">
            <h2 className="font-headline text-3xl md:text-5xl font-bold mb-4">El ADN de la Moldería Digital</h2>
            <div className="w-24 h-1 bg-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 group relative overflow-hidden bg-surface-container-highest rounded-xl p-8 transition-all hover:bg-surface-variant">
              <span className="material-symbols-outlined text-primary text-4xl mb-6">gesture</span>
              <h3 className="font-headline text-2xl font-bold mb-4 uppercase tracking-tight">Diseño de Patrones</h3>
              <p className="font-body text-on-surface-variant max-w-xl leading-relaxed">
                Aprende los fundamentos de la construcción en Audaces. Transforma ideas abstractas en planos técnicos bidimensionales con precisión milimétrica.
              </p>
              <div className="mt-8 flex gap-4">
                <span className="px-3 py-1 bg-surface-container-low border border-outline-variant/20 rounded font-label text-[10px] text-on-surface-variant uppercase">Audaces CAD</span>
                <span className="px-3 py-1 bg-surface-container-low border border-outline-variant/20 rounded font-label text-[10px] text-on-surface-variant uppercase">Lógica Vectorial</span>
              </div>
              <div className="absolute -right-20 -bottom-20 opacity-5 group-hover:opacity-15 transition-opacity">
                <span className="material-symbols-outlined text-[300px]">architecture</span>
              </div>
            </div>

            <div className="md:col-span-4 bg-surface-container-highest rounded-xl p-8 border-l-2 border-secondary hover:-translate-y-1 transition-transform">
              <span className="material-symbols-outlined text-secondary text-4xl mb-6">straighten</span>
              <h3 className="font-headline text-2xl font-bold mb-4 uppercase tracking-tight">Escalado</h3>
              <p className="font-body text-on-surface-variant text-sm leading-relaxed mb-6">
                Escalado industrial automatizado. Domina las reglas de crecimiento por talles sin perder la esencia del diseño original.
              </p>
              <ul className="space-y-2">
                {['Tabla de Talles Pro', 'Algoritmos de Ajuste'].map(item => (
                  <li key={item} className="flex items-center gap-2 font-label text-[10px] text-on-surface-variant uppercase">
                    <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-4 bg-surface-container rounded-xl p-8 border border-outline-variant/10">
              <span className="material-symbols-outlined text-tertiary text-4xl mb-6">print</span>
              <h3 className="font-headline text-xl font-bold mb-4 uppercase tracking-tight">Impresión y Trazado</h3>
              <p className="font-body text-on-surface-variant text-sm leading-relaxed">
                Del archivo digital a la mesa de corte. Exporta a plotters industriales y PDF con marcas de registro exactas.
              </p>
            </div>

            <div className="md:col-span-8 bg-gradient-to-br from-surface-container to-surface-container-lowest rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-primary/10">
              <div>
                <p className="font-headline text-4xl font-bold">8 Módulos</p>
                <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Contenido Técnico Intensivo</p>
              </div>
              <Link to="/temario" className="flex items-center gap-2 text-primary font-headline font-bold uppercase tracking-widest group hover:gap-3 transition-all">
                Ver Programa
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scrolling Banner */}
      <section className="py-10 bg-surface-container-highest border-y border-outline-variant/15 overflow-hidden">
        <div className="flex whitespace-nowrap gap-12" style={{ animation: 'scroll 20s linear infinite' }}>
          {['Cupos Limitados ·', 'Inscríbete Ahora ·', 'Últimas Vacantes ·', 'Certificación Profesional ·', 'Cupos Limitados ·', 'Inscríbete Ahora ·'].map((t, i) => (
            <span key={i} className={`font-headline text-4xl font-black uppercase italic ${i % 2 === 0 ? 'text-outline-variant/30' : i % 3 === 0 ? 'text-primary' : 'text-secondary'}`}>{t}</span>
          ))}
        </div>
        <style>{`@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </section>

      {/* Instructors */}
      <section className="py-24 px-6 lg:px-20">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <span className="badge-secondary mb-4">Los Docentes</span>
            <h2 className="font-headline text-3xl md:text-5xl font-bold mt-4">Aprende con los mejores</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Luis */}
            <div className="card border border-outline-variant/20 flex flex-col items-center text-center gap-4">
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg">
                <img src={luisBlack} alt="Luis" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl">Luis</h3>
                <p className="text-primary text-xs font-bold uppercase tracking-widest mt-1">Ing. Electrónico & Co-Fundador</p>
                <p className="text-on-surface-variant text-xs uppercase tracking-widest font-medium">Desarrollador</p>
                <p className="text-on-surface-variant text-sm mt-3">Especialista en tecnología aplicada a la industria textil y desarrollo de plataformas educativas digitales.</p>
              </div>
            </div>
            {/* Cristian */}
            <div className="card border border-outline-variant/20 flex flex-col items-center text-center gap-4">
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-secondary/40 shadow-lg">
                <img src={cristian} alt="Cristian" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl">Cristian</h3>
                <p className="text-secondary text-xs font-bold uppercase tracking-widest mt-1">Moldería & Co-fundador</p>
                <p className="text-on-surface-variant text-sm mt-3">Profesional en moldería digital con años de experiencia en Audaces. Especialista en escalado y tizada industrial.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 lg:px-20 text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-tertiary/5 blur-[100px] rounded-full -z-10" />
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="font-headline text-4xl md:text-6xl font-bold tracking-tight">
            Eleva tu taller al <span className="text-secondary italic">estándar digital</span>
          </h2>
          <p className="font-body text-on-surface-variant text-lg">
            Súmate a nuestro curso presencial. El futuro de la moda con Audaces es digital, exacto y sostenible.
          </p>
          <div className="inline-block p-[2px] bg-gradient-to-r from-primary via-secondary to-tertiary rounded-xl">
            <Link to="/inscripcion" className="bg-surface block px-12 py-6 rounded-xl font-headline font-bold uppercase tracking-widest text-xl hover:bg-transparent transition-colors">
              Inscríbete por $400.000
            </Link>
          </div>
          <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Garantía de satisfacción de 7 días</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 lg:px-20 bg-surface-container-lowest border-t border-outline-variant/10 mb-20 md:mb-0">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
            {/* Brand + Logo */}
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                {/* <img src={logo} alt="Moldi Tex Logo" className="w-10 h-10 object-contain" /> */}
                <span className="text-xl font-black tracking-tighter text-primary font-headline uppercase">Moldi Tex</span>
              </div>
              <p className="font-body text-sm text-on-surface-variant mb-5">La academia de formación técnica presencial en Audaces para la industria de la moda.</p>
              {/* Social links */}
              <div className="flex items-center gap-3">
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-variant hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant">
                  {/* Instagram SVG */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-variant hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-variant hover:bg-primary/20 hover:text-primary transition-all text-on-surface-variant">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
                </a>
                <a href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="WhatsApp"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-variant hover:bg-secondary/20 hover:text-secondary transition-all text-on-surface-variant">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-headline font-bold uppercase text-xs tracking-widest mb-4">Explora</h4>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li><Link to="/temario" className="hover:text-primary transition-colors">Programa</Link></li>
                <li><Link to="/ventajas" className="hover:text-primary transition-colors">Beneficios</Link></li>
                <li><Link to="/inscripcion" className="hover:text-primary transition-colors">Inscripción</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-headline font-bold uppercase text-xs tracking-widest mb-4">Contacto</h4>
              <ul className="space-y-3 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm mt-0.5">location_on</span>
                  <div>
                    <p className="font-bold text-on-surface">Soldado Juan Rava 1020</p>
                    <p className="text-xs">Esquina Av. Olavaría — Presencial</p>
                    <a href="https://maps.app.goo.gl/FmbCU43bg3Ezh5gw9" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[11px]">map</span>Ver en Google Maps
                    </a>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  <a href="mailto:ing.lp.tech@gmail.com" className="hover:text-primary transition-colors">ing.lp.tech@gmail.com</a>
                </li>
                <li className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-secondary shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  <a href="https://wa.me/5491162020911" target="_blank" rel="noreferrer" className="hover:text-secondary transition-colors">+54 11 6202-0911</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-outline-variant/10 flex flex-col items-center justify-center gap-4 text-center pb-8 md:pb-0">
            <p className="font-label text-[10px] text-outline uppercase tracking-[0.3em] md:tracking-[0.5em]">© 2025 MOLDI TEX. TODOS LOS DERECHOS RESERVADOS.</p>
            {/* Creator credit */}
            <a
              href="https://www.tiktok.com/@ingeniero_emprendedor"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current opacity-60 group-hover:opacity-100"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
              <span className="font-label text-[10px] uppercase tracking-widest">Desarrollado por @ingeniero_emprendedor</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
