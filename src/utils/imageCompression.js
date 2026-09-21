/**
 * Comprime una imagen en el browser usando Canvas API sin dependencias extra.
 * Redimensiona al lado mayor máx `maxPx` y la convierte a JPEG con `quality`.
 * Objetivo: < 250KB por imagen para no saturar el storage de Supabase.
 */
export function compressImage(file, maxPx = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Error al comprimir la imagen')),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
  });
}

/** Devuelve el tamaño en KB con 1 decimal */
export function sizeKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// WebP + miniatura — para el catálogo de productos
//
// `compressImage()` de arriba NO se toca: la usan MoldesAdminPage y
// FinanzasPage, y anda bien. Estas funciones viven al lado y las usa solo
// `imagenesProducto.js`.
//
// El catálogo mostraba la misma imagen de detalle (~250 KB) en las tarjetas.
// Con 12 productos en pantalla eso son ~3 MB de descarga. La miniatura de
// 480px pesa ~25 KB, así que la misma pantalla baja a ~300 KB.
// ─────────────────────────────────────────────────────────────────────────────

// Un navegador sin soporte WebP no falla al pedirlo: `toBlob` devuelve un PNG
// EN SILENCIO, y un PNG pesa bastante MÁS que el JPEG original. O sea que sin
// esta detección, "optimizar" empeoraría las cosas. Se calcula una sola vez.
let _soportaWebP = null;
export function soportaWebP() {
  if (_soportaWebP !== null) return _soportaWebP;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    _soportaWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _soportaWebP = false;
  }
  return _soportaWebP;
}

// Devuelve { blob, ext, contentType }. La extensión la decide el formato real
// que se pudo generar, así el path guardado nunca miente sobre su contenido.
function comprimirA(file, maxPx, calidadWebp, calidadJpeg) {
  return new Promise((resolve, reject) => {
    const webp = soportaWebP();
    const contentType = webp ? 'image/webp' : 'image/jpeg';
    const ext = webp ? 'webp' : 'jpg';
    const calidad = webp ? calidadWebp : calidadJpeg;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob => blob
            ? resolve({ blob, ext, contentType })
            : reject(new Error('Error al comprimir la imagen')),
          contentType,
          calidad
        );
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
  });
}

/** Imagen de detalle: 1200px. WebP q0.72 (~70-110 KB) o JPEG q0.80 si no hay soporte. */
export function comprimirWeb(file) {
  return comprimirA(file, 1200, 0.72, 0.80);
}

/** Miniatura para las tarjetas del catálogo: 480px, ~15-25 KB. */
export function generarThumb(file) {
  return comprimirA(file, 480, 0.70, 0.75);
}
