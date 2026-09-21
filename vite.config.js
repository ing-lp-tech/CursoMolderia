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

      // Cada endpoint de api/ que quieras usar en `npm run dev` tiene que
      // estar acá. Si falta, la llamada cae al next(), Vite devuelve el HTML
      // de la SPA y el fetch explota con "Unexpected end of JSON input", que
      // no dice nada sobre la causa real.
      //
      // Los imports son funciones flecha para que Vite los resuelva de forma
      // estática y los cargue recién cuando se usan.
      const ROUTES = {
        'create-preference':          () => import('./api/create-preference.js'),
        'crear-alumno':               () => import('./api/crear-alumno.js'),
        'eliminar-alumno':            () => import('./api/eliminar-alumno.js'),
        'reset-password-alumno':      () => import('./api/reset-password-alumno.js'),
        'create-molde-preference':    () => import('./api/create-molde-preference.js'),
        'create-molde-transferencia': () => import('./api/create-molde-transferencia.js'),
        'molde-aprobar':              () => import('./api/molde-aprobar.js'),
        // Flujo de productos: comprar, cotizar el envío y aprobar desde el panel.
        'create-producto':            () => import('./api/create-producto.js'),
        'producto-admin':             () => import('./api/producto-admin.js'),
        'envia-cotizar':              () => import('./api/envia-cotizar.js'),
        'envia-webhook':              () => import('./api/envia-webhook.js'),
      };
      const matched = Object.keys(ROUTES).find(r => req.url.includes(r));

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

          const handler = (await ROUTES[matched]()).default;
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
