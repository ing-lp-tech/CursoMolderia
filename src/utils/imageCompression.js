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
