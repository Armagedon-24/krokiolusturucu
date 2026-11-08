import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// DEPLOY TABANI: GitHub Pages alt dizinde (/krokiolusturucu/) "npm run build:pages" ile;
// kök dağıtım (Vercel) varsayılan '/' ile derlenir. withBase() tüketim katmanı runtime
// yollarını aynı tabana göre çözer (src/utils/assetMigration.ts).
const BASE = process.env.VITE_BASE || '/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // CSP uyumu: kayıt betiği satır içi DEĞİL, harici dosya olarak eklenir
      // (index.html'deki script-src 'self' kuralı satır içi betiği engeller).
      injectRegister: 'script-defer',
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
        // HIZ: Uygulama kabuğu (js/css/html) precache edilir; 700+ sembol görseli ve
        // font klasörleri DIŞARIDA bırakılır — bunlar istek geldikçe CacheFirst ile
        // çalışma-anı önbelleğine alınır (aşağıda). Not: Vite bundle çıktısı da
        // dist/assets/ altına yazıldığı için yalnızca symbols/ ve fonts/ dizinleri
        // hariç tutulur; aksi halde uygulama kodu precache'den düşer.
        globPatterns: ['**/*.{js,css,html,ico}'],
        globIgnores: ['**/assets/symbols/**', '**/assets/fonts/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Sembol PNG/SVG + fontlar: bir kez indirilen dosya kalıcı önbellekte
            urlPattern: ({ request, url }) => url.pathname.startsWith('/assets/') && (request.destination === 'image' || request.destination === 'font' || request.destination === ''),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kroki-assets-v2',
              expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bulut (Cloudinary) sembol/görsel/thumb URL'leri
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kroki-cloudinary',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
        // HIZ (Rolldown): native advancedChunks kullanılır — function-form manualChunks
        // Rolldown'da three.core.js gibi modülleri catch-all vendor'a düşürebiliyor ve
        // 1.2MB'lık three.js açılışta yükleniyordu. Aşağıdaki gruplarla ağır bağımlılıklar
        // yalnızca kullanıldıklarında indirilir:
        //   - vendor-three  : yalnızca 3D önizleme modalı (lazy)
        //   - vendor-map    : yalnızca harita seçici (lazy)
        //   - vendor-export : yalnızca PDF/HTML dışa aktarma (lazy)
        // react-reconciler bilinçli olarak vendor-react'te (react-konva açılışta gerekir).
        advancedChunks: {
          groups: [
            // Paylaşımlı runtime parçaları HER ZAMAN eager chunk'ta olmalı; aksi halde
            // Rolldown bunları lazy vendor chunk'larına indirip açılışı ona bağlayabiliyor.
            { name: 'vendor-runtime', test: /(core-js|preload-helper|[\\/]node_modules[\\/]raf[\\/])/ },
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|react-is|scheduler|react-reconciler|use-sync-external-store)[\\/]/ },
            { name: 'vendor-three', test: /[\\/]node_modules[\\/](@react-three|three|three-stdlib|troika-|maath|detect-gpu|utility-types)[\\/]/ },
            { name: 'vendor-konva', test: /[\\/]node_modules[\\/](konva|react-konva|canvas)[\\/]/ },
            { name: 'vendor-map', test: /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet|@mapbox|h3-js|proj4)[\\/]/ },
            { name: 'vendor-export', test: /[\\/]node_modules[\\/](jspdf|html2canvas|canvg|pako|dompurify|fflate)[\\/]/ },
            { name: 'vendor-state', test: /[\\/]node_modules[\\/](zustand|uuid|use-image)[\\/]/ },
            { name: 'vendor-ui', test: /[\\/]node_modules[\\/](lucide-react|clsx|class-variance-authority)[\\/]/ },
          ],
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
