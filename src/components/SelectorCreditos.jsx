// Selector − / N / + para los planes que se compran por cantidad, hoy los
// créditos de digitalización: 1 crédito = 1 digitalización.
//
// Vive aparte de PizarrasPage porque la tienda unificada lo va a usar con el
// mismo plan, y porque el total en vivo es lo que evita la pregunta
// "¿cuánto me sale?" por WhatsApp.

export default function SelectorCreditos({
  cantidad,
  min = 1,
  max = 100,
  precioUnitario,
  onChange,
  etiqueta = '¿Cuántos créditos querés?',
  ayuda = '1 crédito = 1 digitalización',
}) {
  const total = Number(precioUnitario) * cantidad;

  // El input se puede tipear: para comprar 50 créditos nadie quiere apretar
  // el + cincuenta veces.
  function escribir(e) {
    const n = parseInt(e.target.value, 10);
    if (Number.isNaN(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  }

  return (
    <div className="rounded-2xl bg-surface-variant/50 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{etiqueta}</p>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, cantidad - 1))}
          disabled={cantidad <= min}
          aria-label="Quitar un crédito"
          className="w-11 h-11 rounded-full border-2 border-outline-variant/40 flex items-center justify-center text-on-surface hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span className="material-symbols-outlined">remove</span>
        </button>

        <input
          type="number"
          inputMode="numeric"
          value={cantidad}
          min={min}
          max={max}
          onChange={escribir}
          aria-label="Cantidad de créditos"
          className="input-field w-20 text-center font-headline font-black text-xl"
        />

        <button
          type="button"
          onClick={() => onChange(Math.min(max, cantidad + 1))}
          disabled={cantidad >= max}
          aria-label="Agregar un crédito"
          className="w-11 h-11 rounded-full border-2 border-outline-variant/40 flex items-center justify-center text-on-surface hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {ayuda && <p className="text-xs text-center text-on-surface-variant">{ayuda}</p>}

      <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
        <span className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">Total</span>
        <span className="font-headline font-black text-primary text-lg">${total.toLocaleString('es-AR')}</span>
      </div>
    </div>
  );
}
