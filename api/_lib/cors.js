// CORS compartido para los endpoints de pizarras/envia.com.
const ALLOWED_ORIGINS = [
  'https://curso-molderia.vercel.app',
  'https://molditex.vercel.app',
  'https://www.molderia-digital.com',
  'https://molderia-digital.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Vercel genera una URL de preview distinta en cada deploy
// (ej: curso-molderia-l4yjtx403-inglptechs-projects.vercel.app).
// Este patrón cubre cualquier preview de este proyecto sin tener
// que ir agregando hashes a mano cada vez que se hace un deploy.
const PREVIEW_ORIGIN_RE = /^https:\/\/curso-molderia-[a-z0-9]+-inglptechs-projects\.vercel\.app$/;

function origenPermitido(origin) {
  return !!origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin));
}

export function setCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers.origin || '';
  if (origenPermitido(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Devuelve true (y ya respondió el 403) si el origen no está permitido.
export function bloquearSiOrigenInvalido(req, res) {
  const origin = req.headers.origin || '';
  if (process.env.NODE_ENV === 'production' && !origenPermitido(origin)) {
    res.status(403).json({ error: 'Origen no autorizado' });
    return true;
  }
  return false;
}
