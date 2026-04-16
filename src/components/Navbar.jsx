import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/',            label: 'Inicio',      icon: 'home' },
  { to: '/temario',     label: 'Programa',    icon: 'tactic' },
  { to: '/ventajas',    label: 'Beneficios',  icon: 'star' },
  { to: '/inscripcion', label: 'Inscribirse', icon: 'payments' },
];

export default function Navbar() {
  const { pathname }                  = useLocation();
  const { user, isAdmin, signOut }    = useAuth();
  const [menuOpen, setMenuOpen]       = useState(false);

  const isStudent = user && !isAdmin;

  // Bloquear scroll cuando el menú móvil está abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function close() { setMenuOpen(false); }

  return (
    <>
      {/* ── Barra principal ───────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-[#1a1a1a]/70 backdrop-blur-xl border-b border-[#484847]/15 shadow-[0_8px_32px_rgba(184,159,255,0.1)] flex justify-between items-center px-4 md:px-6 h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-primary">architecture</span>
          <span className="text-xl font-black tracking-tighter text-primary font-headline uppercase">Moldi Tex</span>
        </Link>

        {/* Desktop: links centrales */}
        <div className="hidden md:flex gap-1 items-center">
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-headline font-bold uppercase text-sm tracking-tight transition-colors px-3 py-1.5 rounded-lg ${
                pathname === link.to
                  ? 'text-secondary bg-secondary/10'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop: acciones derecha */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {isStudent && (
                <Link
                  to="/portal"
                  className="flex items-center gap-2 btn-primary text-sm py-2 px-4"
                >
                  <span className="material-symbols-outlined text-base">school</span>
                  Mis Clases
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-2 btn-secondary text-sm py-2 px-4">
                  <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                  Admin
                </Link>
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 text-on-surface-variant hover:text-error transition-colors text-sm font-bold px-3 py-2 rounded-lg hover:bg-error/10"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary text-sm py-2 px-5">Ingresar</Link>
          )}
        </div>

        {/* ── Mobile: iconos rápidos + hamburguesa ───────────────── */}
        <div className="md:hidden flex items-center gap-1">
          {/* Botón "Mis Clases" rápido solo para estudiantes en mobile */}
          {isStudent && (
            <Link
              to="/portal"
              onClick={close}
              className="flex items-center gap-1.5 bg-primary text-white font-bold text-xs uppercase tracking-wide px-3 py-2 rounded-xl mr-1"
            >
              <span className="material-symbols-outlined text-base">school</span>
              Mis clases
            </Link>
          )}
          {/* Icono admin rápido en mobile */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={close}
              className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              aria-label="Panel admin"
            >
              <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
            </Link>
          )}
          {/* Login / Salir rápido */}
          {user ? (
            <button
              onClick={() => { signOut(); close(); }}
              className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
              aria-label="Salir"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
            </button>
          ) : (
            <Link to="/login" onClick={close} className="p-2 rounded-lg" aria-label="Ingresar">
              <span className="material-symbols-outlined text-primary text-[22px]">login</span>
            </Link>
          )}
          {/* Hamburguesa */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            aria-label="Menú"
          >
            <span className="material-symbols-outlined text-[28px]">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Menú móvil ────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-[#111]/95 backdrop-blur-2xl z-40 flex flex-col overflow-y-auto border-t border-[#484847]/20 animate-in fade-in duration-200">

          <div className="flex-1 px-4 pt-6 pb-10 space-y-2">

            {/* Card destacada: portal del estudiante */}
            {isStudent && (
              <Link
                to="/portal"
                onClick={close}
                className="flex items-center gap-4 p-5 rounded-2xl bg-primary/15 border border-primary/30 text-primary mb-4"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">school</span>
                </div>
                <div>
                  <p className="font-headline font-bold text-base uppercase tracking-wide">Mis Clases</p>
                  <p className="text-xs text-primary/70 mt-0.5">Ver videos y materiales del curso</p>
                </div>
                <span className="material-symbols-outlined text-xl ml-auto opacity-60">arrow_forward</span>
              </Link>
            )}

            {/* Card destacada: panel admin */}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={close}
                className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary mb-4"
              >
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                </div>
                <div>
                  <p className="font-headline font-bold text-base uppercase tracking-wide">Panel Admin</p>
                  <p className="text-xs text-secondary/70 mt-0.5">Gestionar el curso</p>
                </div>
                <span className="material-symbols-outlined text-xl ml-auto opacity-60">arrow_forward</span>
              </Link>
            )}

            {/* Links de navegación pública */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 px-2 pt-2 pb-1">Navegación</p>
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={close}
                className={`flex items-center gap-4 p-4 rounded-xl font-headline font-bold text-base uppercase tracking-wide transition-all ${
                  pathname === link.to
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{link.icon}</span>
                {link.label}
              </Link>
            ))}

            {/* Footer del menú */}
            <div className="pt-4 border-t border-outline-variant/10 mt-4">
              {user ? (
                <button
                  onClick={() => { signOut(); close(); }}
                  className="flex items-center gap-4 p-4 w-full rounded-xl text-on-surface-variant hover:bg-error/10 hover:text-error font-headline font-bold text-base uppercase tracking-wide transition-all"
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  Cerrar sesión
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={close}
                  className="flex items-center justify-center gap-2 p-4 w-full rounded-xl bg-primary text-white font-headline font-bold text-base uppercase tracking-wide"
                >
                  <span className="material-symbols-outlined text-xl">login</span>
                  Ingresar
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de navegación inferior fija (solo mobile) ─────── */}

      {/* Estudiante */}
      {isStudent && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-outline-variant/20 flex items-center justify-around px-2 py-2 safe-bottom">
          <Link
            to="/"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${pathname === '/' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">home</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Inicio</span>
          </Link>
          <Link
            to="/portal"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${pathname === '/portal' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">school</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Mis Clases</span>
          </Link>
          <Link
            to="/inscripcion"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${pathname === '/inscripcion' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">payments</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Inscripción</span>
          </Link>
          <button
            onClick={() => { signOut(); close(); }}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-on-surface-variant hover:text-error transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Salir</span>
          </button>
        </nav>
      )}

      {/* Admin */}
      {isAdmin && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-secondary/20 flex items-center justify-around px-2 py-2 safe-bottom">
          <Link
            to="/admin"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname === '/admin' ? 'text-secondary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">dashboard</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Panel</span>
          </Link>
          <Link
            to="/admin/estudiantes"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname.startsWith('/admin/estudiantes') ? 'text-secondary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">school</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Alumnos</span>
          </Link>
          <Link
            to="/admin/finanzas"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname.startsWith('/admin/finanzas') ? 'text-secondary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Finanzas</span>
          </Link>
          <Link
            to="/admin/recursos"
            onClick={close}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${pathname.startsWith('/admin/recursos') ? 'text-secondary' : 'text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[22px]">video_library</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Recursos</span>
          </Link>
          <button
            onClick={() => { signOut(); close(); }}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-on-surface-variant hover:text-error transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Salir</span>
          </button>
        </nav>
      )}

      {/* Botón flotante WhatsApp */}
      <a
        href="https://wa.me/5491162020911?text=Hola!%20Me%20gustar%C3%ADa%20saber%20m%C3%A1s%20sobre%20el%20curso%20de%20molder%C3%ADa%20con%20Audaces."
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-24 md:bottom-8 right-5 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 group overflow-hidden"
        style={{ paddingRight: '1rem', paddingLeft: '1rem', height: '3.25rem' }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current shrink-0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="text-sm font-bold hidden md:block whitespace-nowrap">¿Consultas?</span>
      </a>
    </>
  );
}
