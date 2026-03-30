import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/temario', label: 'Programa', icon: 'tactic' },
  { to: '/ventajas', label: 'Beneficios', icon: 'star' },
  { to: '/inscripcion', label: 'Inscribirse', icon: 'payments' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  return (
    <>
      {/* Desktop/Mobile Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#1a1a1a]/70 backdrop-blur-xl border-b border-[#484847]/15 shadow-[0_8px_32px_rgba(184,159,255,0.1)] flex justify-between items-center px-6 h-16">
        <Link to="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">architecture</span>
          <span className="text-xl font-black tracking-tighter text-primary font-headline uppercase">Moldi Tex</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex gap-6 items-center">
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-headline font-bold uppercase text-sm tracking-tight transition-colors duration-300 px-3 py-1 rounded ${
                pathname === link.to ? 'text-secondary' : 'text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link to="/admin" className="text-primary font-headline font-bold uppercase text-sm tracking-tight hover:underline">
                  Admin
                </Link>
              )}
              <button onClick={signOut} className="btn-secondary text-xs py-2 px-4">Salir</button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-xs py-2 px-5">Ingresar</Link>
          )}
        </div>

        {/* Mobile: just show login icon */}
        <div className="md:hidden flex items-center gap-2">
          {user ? (
            <button onClick={signOut} className="text-on-surface-variant">
              <span className="material-symbols-outlined">logout</span>
            </button>
          ) : (
            <Link to="/login">
              <span className="material-symbols-outlined text-primary">login</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-4 bg-[#1a1a1a]/70 backdrop-blur-xl border-t border-[#484847]/15">
        {NAV_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex flex-col items-center justify-center px-3 py-1 active:translate-y-0.5 transition-transform ${
              pathname === link.to
                ? 'text-secondary bg-surface-variant rounded-md'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined">{link.icon}</span>
            <span className="font-headline text-[10px] uppercase tracking-widest font-medium mt-1">{link.label}</span>
          </Link>
        ))}
      </nav>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/5491162020911?text=Hola!%20Me%20gustar%C3%ADa%20saber%20m%C3%A1s%20sobre%20el%20curso%20de%20molder%C3%ADa%20con%20Audaces."
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar por WhatsApp"
        className="fixed bottom-24 md:bottom-8 right-5 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 group overflow-hidden"
        style={{ paddingRight: '1rem', paddingLeft: '1rem', height: '3.25rem' }}
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span className="text-sm font-bold hidden md:block whitespace-nowrap">¿Consultas?</span>
      </a>
    </>
  );
}
