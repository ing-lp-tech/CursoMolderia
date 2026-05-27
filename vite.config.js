import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin local para emular el Backend de Vercel en la ruta /api
const vercelApiMock = (env) => ({
  name: 'vercel-api-mock',
  configureServer(server) {
    server.middlewares.use('/api/', async (req, res, next) => {
      // Inyectar env SIN reemplazar el objeto process.env (Object.assign muta el original)
      Object.assign(process.env, env);

      // Shims para emular el objeto 'res' de Vercel
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        }
      };

      const ROUTES = [
        'create-preference',
        'crear-alumno',
        'eliminar-alumno',
        'reset-password-alumno',
        'create-molde-preference',
        'create-molde-transferencia',
        'molde-aprobar',
      ];
      const matched = ROUTES.find(r => req.url.includes(r));

      if (!matched) { return next(); }

      const processRequest = async () => {
        try {
          if (req.method === 'POST') {
            await new Promise((resolve, reject) => {
              // Si el cuerpo ya fue leído (req.body seteado por otro middleware), reutilizarlo
              if (req.body !== undefined) { resolve(); return; }
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              req.on('end', () => {
                try { req.body = body ? JSON.parse(body) : {}; }
                catch { req.body = {}; }
                resolve();
              });
              req.on('error', reject);
              // NO chequear req.complete aquí: aunque el request ya llegó,
              // los eventos data/end igual se emiten cuando agregamos listeners.
              // Chequear req.complete + body==='' causaba una race condition
              // donde resolve() se llamaba antes de que llegaran los datos.
            });
          }

          // Imports estáticos — Vite los resuelve desde la raíz del proyecto
          let handler;
          if (matched === 'create-preference') {
            handler = (await import('./api/create-preference.js')).default;
          } else if (matched === 'crear-alumno') {
            handler = (await import('./api/crear-alumno.js')).default;
          } else if (matched === 'eliminar-alumno') {
            handler = (await import('./api/eliminar-alumno.js')).default;
          } else if (matched === 'reset-password-alumno') {
            handler = (await import('./api/reset-password-alumno.js')).default;
          } else if (matched === 'create-molde-preference') {
            handler = (await import('./api/create-molde-preference.js')).default;
          } else if (matched === 'create-molde-transferencia') {
            handler = (await import('./api/create-molde-transferencia.js')).default;
          } else if (matched === 'molde-aprobar') {
            handler = (await import('./api/molde-aprobar.js')).default;
          }

          await handler(req, res);
        } catch(e) {
          console.error('[API Mock Error]', e);
          res.status(500).json({ error: e.message || 'Error interno' });
        }
      };

      processRequest();
    });
  }
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      tailwindcss(),
      react(),
      vercelApiMock(env)
    ],
  };
})
