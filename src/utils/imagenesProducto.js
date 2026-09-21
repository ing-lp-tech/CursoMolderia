// URLs y subida de las imágenes de un producto.
//
// ── DOS BUCKETS, POR UN RATO ─────────────────────────────────────────────────
// Lo nuevo va a `productos-imagenes`, con carpeta por categoría y WebP. El
// bucket viejo `pizarras-imagenes` sigue vivo solo para las fotos que ya
// estaban subidas: mover archivos y reescribir los paths guardados sería una
// migración de datos, y no hace falta. Cuando vuelvas a subir esas fotos desde
// el panel quedan en el bucket nuevo solas, y recién ahí se borra el viejo
// (script 11).
//
// El bucket de cada path se deduce de su FORMA, no de una columna extra:
//
//   viejo   {producto_id}/img_1.jpg               → 2 segmentos
//   nuevo   {categoria-slug}/{producto_id}/img_1.webp → 3 segmentos
//
// Son unas pocas líneas y se borran junto con el bucket viejo.

import { supabase } from '../lib/supabase';
import { comprimirWeb, generarThumb } from './imageCompression';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const IMG_BUCKET       = 'productos-imagenes';
export const IMG_BUCKET_VIEJO = 'pizarras-imagenes';

// Los paths viejos no tienen carpeta de categoría: un solo '/'.
function bucketDe(path) {
  return path.split('/').length >= 3 ? IMG_BUCKET : IMG_BUCKET_VIEJO;
}

export function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucketDe(path)}/${path}`;
}

// Sube la imagen de detalle y su miniatura, y devuelve los dos paths.
//
// `upsert` con paths deterministas: reemplazar una foto pisa la anterior en vez
// de ir dejando archivos huérfanos acumulándose en el storage.
//
// Si el navegador no soporta WebP, `comprimirWeb` cae a JPEG y la extensión del
// path acompaña, así el archivo guardado nunca miente sobre su contenido.
export async function uploadImagen(file, productoId, slot, categoriaSlug = 'otros') {
  const carpeta = `${categoriaSlug || 'otros'}/${productoId}`;

  const [detalle, thumb] = await Promise.all([
    comprimirWeb(file),
    generarThumb(file),
  ]);

  const imagenPath = `${carpeta}/img_${slot}.${detalle.ext}`;
  const thumbPath  = `${carpeta}/thumb_${slot}.${thumb.ext}`;

  const [{ error: errImagen }, { error: errThumb }] = await Promise.all([
    supabase.storage.from(IMG_BUCKET)
      .upload(imagenPath, detalle.blob, { contentType: detalle.contentType, upsert: true }),
    supabase.storage.from(IMG_BUCKET)
      .upload(thumbPath, thumb.blob, { contentType: thumb.contentType, upsert: true }),
  ]);

  if (errImagen) throw errImagen;
  // Sin miniatura el catálogo no se rompe: `TiendaPage` cae a la imagen de
  // detalle. No vale la pena tirar abajo el guardado del producto por esto.
  if (errThumb) console.error('[THUMB_UPLOAD]', errThumb.message);

  return { imagen_path: imagenPath, thumb_path: errThumb ? null : thumbPath };
}

export function productoImages(p) {
  return [p.imagen_1_path, p.imagen_2_path, p.imagen_3_path].filter(Boolean);
}
