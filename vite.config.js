import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin local para emular el Backend de Vercel en la ruta /api
const vercelApiMock = (env) => ({
  name: 'vercel-api-mock',
  configureServer(server) {
    server.middlewares.use('/api/', async (req, res, next) => {
      // Inyectar env a process.env para que los handlers funcionen como en Vercel
      process.env = { ...process.env, ...env };

      // Shims para emular el objeto 'res' de Vercel
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        }
      };

      const ROUTES = ['create-preference', 'crear-alumno', 'eliminar-alumno', 'reset-password-alumno'];
      const matched = ROUTES.find(r => req.url.includes(r));

      if (!matched) { return next(); }

      const processRequest = async () => {
        try {
          if (req.method === 'POST') {
            await new Promise((resolve) => {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', () => {
                req.body = body ? JSON.parse(body) : {};
                resolve();
              });
              req.on('error', resolve);

              // Si por casualidad el request ya fue leído o completado:
              if (req.complete && body === '') {
                 req.body = {};
                 resolve();
              }
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
