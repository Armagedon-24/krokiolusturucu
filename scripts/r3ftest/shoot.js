// R3F gerçek bileşen testi — ekran görüntüleri
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

  const combos = JSON.parse(process.argv[2] || '[]');
  for (const c of combos) {
    const url = `http://localhost:8792/index.html?kind=${c.kind}&view=${c.view}&color=${encodeURIComponent(c.color || '#2a2e33')}`;
    await page.goto(url);
    try {
      await page.waitForFunction('window.__done === true', { timeout: 20000 });
    } catch (e) { console.log('TIMEOUT', c.name); }
    await page.waitForTimeout(250);
    await page.screenshot({ path: `/tmp/carlab/shots/r3f_${c.name}.png` });
    console.log('OK', `r3f_${c.name}.png`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
