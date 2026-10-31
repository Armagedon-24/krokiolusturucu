import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'icons.svg', 'icon-512.png'],
      manifest: {
        name: 'Kroki Oluşturucu - Olay Yeri Dokümantasyon',
        short_name: 'Kroki',
        description: 'Polis Kriminal Laboratuvarı - Olay Yeri Kroki Oluşturma Sistemi',
        theme_color: '#1e293b',
        background_color: '#111111',
        display: 'standalone',
        icons: [
          { src: 'icon-512.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: { enabled: false },
    }),
    {
      name: 'defer-register-sw',
      enforce: 'post' as const,
      transformIndexHtml: {
        order: 'post' as const,
        handler(html: string) {
          // Make the PWA registerSW.js non-render-blocking by adding defer
          return html
            .replace(
              /(<script\s+id="vite-plugin-pwa:register-sw"\s+src="\/registerSW\.js">)/g,
              '<script defer id="vite-plugin-pwa:register-sw" src="/registerSW.js">'
            )
            .replace(
              /<script src="\/registerSW\.js"><\/script>/g,
              '<script defer src="/registerSW.js"></script>'
            );
        }
      }
    },
    {
      name: 'vercel-api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req: any, res: any, next) => {
          if (req.url.startsWith('/api/')) {
            try {
              const [pathPart] = req.url.split('?');
              const modulePath = `.${pathPart}.ts`;
              const module = await server.ssrLoadModule(modulePath);

              if (!process.env.CLOUDINARY_API_KEY) {
                const fs = await import('fs');
                if (fs.existsSync('.env.local')) {
                  const envContent = fs.readFileSync('.env.local', 'utf-8');
                  envContent.split('\n').forEach(line => {
                    const [key, ...vals] = line.split('=');
                    if (key && vals.length) {
                      process.env[key.trim()] = vals.join('=').replace(/"/g, '').trim();
                    }
                  });
                }
              }

              let body = '';
              req.on('data', (chunk: any) => { body += chunk.toString(); });
              req.on('end', async () => {
                if (body) {
                  try { req.body = JSON.parse(body); } catch { /* ignore */ }
                }
                req.query = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''));
                const vRes: any = {
                  status: (code: number) => { res.statusCode = code; return vRes; },
                  json: (data: any) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); },
                  send: (data: any) => res.end(data),
                  // API işleyicileri Cache-Control vb. başlıklar yazabilir (setHeader mock'u)
                  setHeader: (key: string, value: string) => {
                    try { res.setHeader(key, value); } catch { /* yoksay */ }
                  }
                };
                await module.default(req, vRes);
              });
              return;
            } catch (err) {
              console.error('API execution error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
              return;
            }
          }
          next();
        });
      }
    }
  ],

  build: {
    target: ['es2022', 'chrome100', 'safari15.4', 'firefox100'],
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    cssMinify: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // React core
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-is/')) return 'vendor-react';
          // Three.js ecosystem (heavy, only used in 3D preview modal)
          if (id.includes('/three/') || id.includes('@react-three') || id.includes('@react-spring') || id.includes('/troika-') || id.includes('/maath/') || id.includes('/detect-gpu/') || id.includes('/utility-types/')) return 'vendor-three';
          // Konva canvas
          if (id.includes('/konva/') || id.includes('/react-konva/')) return 'vendor-konva';
          // Map
          if (id.includes('/leaflet/') || id.includes('/react-leaflet/') || id.includes('/@react-leaflet/')) return 'vendor-map';
          // PDF export
          if (id.includes('/jspdf/') || id.includes('/html2canvas/')) return 'vendor-export';
          // State management
          if (id.includes('/zustand/')) return 'vendor-state';
          // UI utilities
          if (id.includes('/lucide-react/') || id.includes('/clsx/') || id.includes('/class-variance-authority/')) return 'vendor-ui';
          // Cloudinary / media
          if (id.includes('/cloudinary') || id.includes('/axios/')) return 'vendor-media';
          // Catch-all
          return 'vendor';
        }
      }
    }
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'konva',
      'react-konva',
      'zustand'
    ]
  }
})
