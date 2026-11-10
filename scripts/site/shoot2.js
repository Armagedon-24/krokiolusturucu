// Arac3D v2 test — ekran görüntüleri
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300)); });

  const combos = JSON.parse(process.argv[2] || '[]');
  const outDir = process.argv[3] || '/tmp/carlab2/shots';
  require('fs').mkdirSync(outDir, { recursive: true });
  for (const c of combos) {
    const p = new URLSearchParams({ kind: c.kind, view: c.view });
    if (c.color) p.set('color', c.color);
    if (c.zh) p.set('zh', String(c.zh));
    if (c.rot) p.set('rot', String(c.rot));
    const url = `http://localhost:8793/index.html?${p.toString()}`;
    await page.goto(url);
    try {
      await page.waitForFunction('window.__done === true', { timeout: 15000 });
    } catch (e) { console.log('TIMEOUT', c.name); }
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/${c.name}.png` });
    console.log('OK', c.name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
