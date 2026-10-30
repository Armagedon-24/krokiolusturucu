/**
 * Kroki Oluşturucu — Electron ana süreci.
 *
 * Akış: yerel statik sunucu (dist/) → BrowserWindow → offline tam fonksiyon.
 * İnternet yalnızca isteğe bağlı özellikler için gerekir:
 *   - Uydu haritası kutuları (ArcGIS/Yandex), geokodlama (Nominatim)
 *   - Bulut galeri / kanıt yükleme (Cloudinary + /api/* uçları)
 * Çekirdek (kroki çizimi, semboller, hesaplayıcılar, bilirkişi PDF'i) tamamen yereldir.
 */
const path = require('path');
const { app, BrowserWindow, Menu, shell } = require('electron');
const { createStaticServer } = require('./server.cjs');

// Tek örnek kilidi: aynı anda iki pencere/aynı veri çakışmasın
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// GPU varsayılan açık (Konva/Three.js için) — devre dışı bırakılmıyor.

async function createWindow() {
  const distDir = path.join(__dirname, '..', 'dist');
  const { server, url } = await createStaticServer(distDir);

  const win = new BrowserWindow({
    width: 1600,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111111',
    title: 'Kroki Oluşturucu - Olay Yeri Dokümantasyon',
    // Pencere/görev çubuğu ikonu: dist'e kopyalanan 512px ikon
    icon: path.join(distDir, 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Uygulama içi indirmeler (jsPDF "indir" vb.) doğrudan İndirilenler'e gitsin
  win.webContents.session.on('will-download', (_e, item) => {
    item.once('done', (_ev, state) => {
      if (state === 'interrupted') console.error('İndirme kesildi:', item.getFilename());
    });
  });

  // Harici bağlantılar (harita sağlayıcı vb.) sistem tarayıcısında açılsın
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target) && !target.startsWith(url)) {
      shell.openExternal(target);
    }
    return { action: 'deny' };
  });

  // SPA dışına gezinmeyi engelle
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(url)) e.preventDefault();
  });

  // Uygulama menüsü yok — temiz arayüz (Ctrl+R/Ctrl+Shift+I yasak değil ama gereksiz)
  Menu.setApplicationMenu(null);

  await win.loadURL(url);
  // Pencere başlığı sayfa tarafından tekrar ayarlanmasın
  win.on('page-title-updated', (e) => e.preventDefault());

  // Temiz kapanış
  win.on('closed', () => {
    server.close();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
