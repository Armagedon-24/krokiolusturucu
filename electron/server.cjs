/**
 * Kroki Oluşturucu — gömülü statik dosya sunucusu (Electron ana süreç).
 *
 * Uygulama http://127.0.0.1:<rastgele port> üzerinden dist/ klasörüne hizmet verir.
 * file:// yerine yerel HTTP kullanma nedenleri:
 *  - fetch() ve woff2/font yüklemeleri file:// altında engellenir
 *  - jsPDF, Leaflet, canvas güvenlik bağlamları http origin bekler
 *
 * Bu modül Electron'a bağımlı DEĞİLDİR → node ile tek başına smoke-test edilebilir.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Statik sunucu oluşturur ve 127.0.0.1 üzerinde rastgele boş portta dinlemeye başlar.
 * @param {string} root  Hizmet verilecek kök klasör (dist/)
 * @returns {Promise<{server: import('http').Server, port: number, url: string}>}
 */
function createStaticServer(root) {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      // Yol güvenliği: root dışına çıkmayı engelle
      const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(root, safe);
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }

      let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      if (stat && stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      }

      // SPA fallback: dosya yok ve yol uzantısızsa index.html (tek sayfa uygulama)
      if (!stat) {
        const ext = path.extname(filePath);
        if (!ext || ext === '.html') {
          filePath = path.join(root, 'index.html');
          stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        }
      }

      if (!stat) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        // Yerel sunucu: önbellek karmaşası istemiyoruz (dosyalar diskten okunur)
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}/` });
    });
  });
}

module.exports = { createStaticServer };
