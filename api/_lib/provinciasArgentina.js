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
