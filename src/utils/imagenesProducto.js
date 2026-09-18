// URLs de las imágenes de un producto.
//
// El bucket todavía se llama `pizarras-imagenes`: renombrarlo implica mover los
// archivos y reescribir las rutas guardadas, y eso es la Parte 9 del plan
// (junto con la compresión a WebP). Mientras tanto, plotters y PCs guardan sus
// fotos acá también. Funciona igual; solo el nombre quedó viejo.

import { supabase } from '../lib/supabase';
import { compressImage } from './imageCompression';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const IMG_BUCKET = 'pizarras-imagenes';

export function imgUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMG_BUCKET}/${path}`;
}

// Sube una imagen ya comprimida al slot indicado. `upsert` para que reemplazar
// una foto no deje archivos huérfanos acumulándose en el bucket.
export async function uploadImagen(file, productoId, slot) {
  const blob = await compressImage(file);
  const path = `${productoId}/img_${slot}.jpg`;
  const { error } = await supabase.storage
    .from(IMG_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export function productoImages(p) {
  return [p.imagen_1_path, p.imagen_2_path, p.imagen_3_path].filter(Boolean);
}

