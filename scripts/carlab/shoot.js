// Test sayfalarını playwright ile fotoğrafla
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

  const combos = JSON.parse(process.argv[2] || '[]');
  const outDir = process.argv[3] || '/tmp/carlab/shots';
  for (const c of combos) {
    const url = `http://localhost:8791/test.html?kind=${c.kind}&view=${c.view}&color=${encodeURIComponent(c.color || '#2a2e33')}&rot=${c.rot || 0}`;
    await page.goto(url);
    await page.waitForFunction('window.__done === true', { timeout: 15000 });
    await page.waitForTimeout(120);
    const f = `${outDir}/${c.name}.png`;
    await page.screenshot({ path: f });
    console.log('OK', f);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
