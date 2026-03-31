import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plugin local para emular el Backend de Vercel en la ruta /api
const vercelApiMock = () => ({
  name: 'vercel-api-mock',
  configureServer(server) {
    server.middlewares.use('/api/', async (req, res, next) => {
      // Shims para emular el objeto 'res' de Vercel
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      if (req.url.includes('create-preference')) {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
            const handler = (await import('./api/create-preference.js')).default;
            await handler(req, res);
          } catch(e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({error: e.message}));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    vercelApiMock()
  ],
})
