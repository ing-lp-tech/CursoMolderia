import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function StudentPortal() {
  const { user, signOut } = useAuth();
  const nombre = user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Estudiante';

  return (
    <div className="min-h-screen pt-16">
      {/* Top bar */}
      <header className="h-16 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">architecture</span>
          <span className="font-headline font-black text-primary uppercase tracking-tighter">Moldi Tex</span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors text-sm font-bold"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Salir
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Welcome */}
        <div className="mb-12">
          <span className="badge badge-secondary mb-3">Área de Estudiantes</span>
          <h1 className="font-headline text-3xl md:text-4xl font-bold mt-2">
            Bienvenido, <span className="gradient-text capitalize">{nombre}</span>
          </h1>
          <p className="text-on-surface-variant mt-2">Tu acceso al curso de Moldería Audaces.</p>
        </div>

        {/* Status card */}
        <div className="card border border-secondary/20 mb-8">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-secondary text-3xl mt-1">school</span>
            <div>
              <h2 className="font-headline font-bold text-xl mb-1">Curso Presencial de Moldería Audaces</h2>
              <p className="text-on-surface-variant text-sm mb-4">Las clases presenciales se desarrollan en el taller. El material adicional aparecerá aquí una vez activado tu pase.</p>
              <span className="badge badge-outline">Pendiente de activación</span>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="card border border-outline-variant/20">
            <span className="material-symbols-outlined text-primary text-2xl mb-3">account_circle</span>
            <h3 className="font-headline font-bold mb-1">Tu cuenta</h3>
            <p className="text-on-surface-variant text-sm">{user?.email}</p>
          </div>
          <div className="card border border-outline-variant/20">
            <span className="material-symbols-outlined text-secondary text-2xl mb-3">receipt_long</span>
            <h3 className="font-headline font-bold mb-1">Pagos</h3>
            <p className="text-on-surface-variant text-sm">Tu historial de pagos y comprobantes.</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-on-surface-variant text-sm mb-4">¿Tenés dudas? Contactate con el administrador del curso.</p>
          <Link to="/" className="btn-secondary inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">home</span>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
