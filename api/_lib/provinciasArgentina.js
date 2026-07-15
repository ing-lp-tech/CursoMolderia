// Mapeo de provincias argentinas a su código ISO 3166-2 (sin el prefijo "AR-"),
// que es el formato que exigen la mayoría de las APIs de paquetería (incluida envia.com).
export const PROVINCIAS_ARGENTINA = [
  { nombre: 'Buenos Aires',        codigo: 'B' },
  { nombre: 'CABA',                codigo: 'C' },
  { nombre: 'Catamarca',           codigo: 'K' },
  { nombre: 'Chaco',               codigo: 'H' },
  { nombre: 'Chubut',              codigo: 'U' },
  { nombre: 'Córdoba',             codigo: 'X' },
  { nombre: 'Corrientes',          codigo: 'W' },
  { nombre: 'Entre Ríos',          codigo: 'E' },
  { nombre: 'Formosa',             codigo: 'P' },
  { nombre: 'Jujuy',               codigo: 'Y' },
  { nombre: 'La Pampa',            codigo: 'L' },
  { nombre: 'La Rioja',            codigo: 'F' },
  { nombre: 'Mendoza',             codigo: 'M' },
  { nombre: 'Misiones',            codigo: 'N' },
  { nombre: 'Neuquén',             codigo: 'Q' },
  { nombre: 'Río Negro',           codigo: 'R' },
  { nombre: 'Salta',               codigo: 'A' },
  { nombre: 'San Juan',            codigo: 'J' },
  { nombre: 'San Luis',            codigo: 'D' },
  { nombre: 'Santa Cruz',          codigo: 'Z' },
  { nombre: 'Santa Fe',            codigo: 'S' },
  { nombre: 'Santiago del Estero', codigo: 'G' },
  { nombre: 'Tierra del Fuego',    codigo: 'V' },
  { nombre: 'Tucumán',             codigo: 'T' },
];

export function codigoProvincia(nombre) {
  const found = PROVINCIAS_ARGENTINA.find(p => p.nombre.toLowerCase() === String(nombre || '').toLowerCase());
  return found?.codigo || nombre;
}

// Arma el Código Postal Argentino (CPA): letra de provincia + 4 dígitos (ej: "B1772").
// envia.com (y los carriers que usa, como Correo Argentino) lo necesitan para
// resolver la zona de entrega — un código postal numérico solo ("1772") no alcanza.
export function codigoPostalCPA(codigoPostal, provincia) {
  const cp = String(codigoPostal || '').trim().toUpperCase();
  if (/^[A-Z]\d{4}[A-Z]{0,3}$/.test(cp)) return cp; // ya viene en formato CPA
  const letra = codigoProvincia(provincia);
  return /^[A-Z]$/.test(letra) ? `${letra}${cp}` : cp;
}
