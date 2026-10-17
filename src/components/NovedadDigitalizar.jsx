import { Link } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext';
import { urlSoftware } from '../utils/software';

// La novedad del software de digitalización, para la landing y /pizarras.
//
// "Digitalizar ahora" va directo al software cuando su dirección está cargada
// en /admin/configuracion; mientras no haya hosting, va a /software, que
// explica cómo conseguir un código. Así el botón nunca lleva a un lugar roto.
//
//   variante="pill" → una línea que se mete arriba de un hero
//   variante="card" → el bloque grande, con los dos botones

function useDestino() {
  const settings = useAppSettings();
  return { app: urlSoftware(settings.software_url) };
}

// Un <a> si sale del sitio (nueva pestaña), un <Link> si se queda.
function Destino({ app, className, children }) {
  return app
    ? <a href={app} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to="/software" className={className}>{children}</Link>;
}

function ChipNuevo() {
  return (
    <span className="relative inline-flex items-center gap-1 rounded-full bg-secondary text-on-secondary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] shrink-0">
      <span className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-40" />
      <span className="relative">Nuevo</span>
    </span>
  );
}

export default function NovedadDigitalizar({ variante = 'card', className = '' }) {
  const { app } = useDestino();

  if (variante === 'pill') {
    return (
      <Destino app={app}
        className={`group inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full border border-secondary/40 bg-secondary/10 hover:bg-secondary/20 shadow-[0_0_24px_rgba(0,227,253,0.15)] transition-all ${className}`}>
        <ChipNuevo />
        <span className="text-sm font-bold text-on-surface">Digitalizá tus moldes online</span>
        <span className="material-symbols-outlined text-secondary text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
      </Destino>
    );
  }

  return (
    <section className={`px-4 ${className}`}>
      <div className="max-w-6xl mx-auto relative overflow-hidden rounded-3xl border-2 border-secondary/40 bg-gradient-to-br from-secondary/15 via-surface-container to-primary/15 p-6 sm:p-10 shadow-[0_0_60px_rgba(0,227,253,0.12)]">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />

        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ChipNuevo />
              <span className="text-xs font-bold uppercase tracking-widest text-secondary">Software de digitalización</span>
            </div>
            <h2 className="font-headline font-black text-2xl sm:text-4xl leading-tight text-on-surface">
              Digitalizá tus moldes <span className="text-secondary">online</span>, desde el navegador
            </h2>
            <p className="text-on-surface-variant max-w-2xl">
              Sacale una foto a tu molde sobre la pizarra y recibilo digitalizado. Entrás con tu código:
              cada crédito es una digitalización.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[260px]">
            <Destino app={app}
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-headline font-black text-base uppercase tracking-wide text-on-secondary bg-secondary hover:brightness-110 shadow-lg shadow-secondary/30 transition-all">
              <span className="material-symbols-outlined text-2xl">document_scanner</span>
              Digitalizar ahora
            </Destino>
            <Link to="/software"
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-on-surface border border-outline-variant/40 hover:bg-surface-variant transition-all">
              <span className="material-symbols-outlined text-lg">key</span>
              Mi código · Comprar créditos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
