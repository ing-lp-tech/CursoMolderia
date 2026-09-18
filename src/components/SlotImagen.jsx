import { useState, useEffect, useRef } from 'react';
import { compressImage } from '../utils/imageCompression';
import { imgUrl } from '../utils/imagenesProducto';

// Un slot de imagen del panel: click para elegir archivo, preview inmediato y
// cruz para quitarla. La subida real la hace quien lo usa, al guardar el
// formulario, con `uploadImagen` de utils/imagenesProducto.
//
// Lo usan el admin de pizarras y el de productos: una sola copia.

// ── Selector de imagen (slot individual) ─────────────────────────────────────
export default function SlotImagen({ valor, onChange, label }) {
  const ref = useRef();
  const [preview, setPreview] = useState(valor ? imgUrl(valor) : null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => { setPreview(valor ? imgUrl(valor) : null); }, [valor]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      const blob = await compressImage(file);
      const url  = URL.createObjectURL(blob);
      setPreview(url);
      onChange(file, blob);
    } catch { alert('Error al procesar la imagen'); }
    finally { setCargando(false); }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        onClick={() => ref.current?.click()}
        className="w-24 h-24 rounded-xl border-2 border-dashed border-outline-variant/40 hover:border-primary/50 transition-all cursor-pointer overflow-hidden flex items-center justify-center bg-surface-variant relative"
      >
        {cargando && <span className="material-symbols-outlined text-primary animate-spin text-2xl">refresh</span>}
        {!cargando && preview && <img src={preview} alt="" className="w-full h-full object-cover" />}
        {!cargando && !preview && <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">add_photo_alternate</span>}
        {!cargando && preview && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setPreview(null); onChange(null, null); }}
            className="absolute top-1 right-1 bg-error text-white rounded-full p-0.5"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        )}
      </div>
      <span className="text-[10px] text-on-surface-variant">{label}</span>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

