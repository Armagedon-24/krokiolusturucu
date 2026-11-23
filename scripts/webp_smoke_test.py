#!/usr/bin/env python3
"""dist duman testi: uygulamayı başlatır, kırık istek/404 ve JS hatalarını toplar,
canvas'a birkaç sembol ekleyip (test kancası) gerçek yükleme doğrular."""
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PORT = 4173
BASE = f"http://localhost:{PORT}"

srv = subprocess.Popen(
    ["npx", "vite", "preview", "--port", str(PORT), "--strictPort"],
    cwd="/home/z/my-project/master-src",
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(4)

failed, errors = [], []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.goto(BASE, wait_until="networkidle", timeout=60000)
        time.sleep(3)

        # Test kancası: store'a birkaç webp sembolü ekleyip gerçek Image yüklemesini dene
        hook = pg.evaluate("""() => {
          const st = window.__krokiStore;
          if (!st) return 'store-yok';
          const urls = [
            '/assets/symbols/karakalem/inline/arch-w1vi.webp',
            '/assets/symbols/karakalem/inline/arch-w1i.webp',
            '/assets/symbols/door.webp',
            '/assets/kurum_logo.webp',
          ];
          let ok = 0, bad = [];
          const checks = urls.map(u => new Promise(res => {
            const img = new Image();
            img.onload = () => { ok++; res(null); };
            img.onerror = () => { bad.push(u); res(u); };
            img.src = u;
          }));
          return Promise.all(checks).then(badList => ({ ok, bad: badList.filter(Boolean) }));
        }""")
        print("KANCA YÜKLEME:", hook)

        # Kapı sembolü ekleme (60x60 düzeltmesi hâlâ yerinde mi kontrolü)
        door = pg.evaluate("""() => {
          const st = window.__krokiStore;
          if (!st) return null;
          const s = st.getState();
          if (!s.addObject) return null;
          s.addObject({ id: 'smoke-kapi-1', type: 'image', name: 'Kapı (Sol)',
            src: '/assets/symbols/karakalem/inline/arch-d1l.webp', x: 300, y: 300, width: 60, height: 60 });
          const obj = s.objects ? s.objects.find(o => o.id === 'smoke-kapi-1') : null;
          return obj ? { w: obj.width, h: obj.height } : 'eklendi-ama-bulunamadi';
        }""")
        print("KAPI EKLEME:", door)

        # Sayfa üzerindeki tüm <img> elemanlarının doğal boyutu geldi mi?
        imgs = pg.evaluate("""() => Array.from(document.images).map(i => ({
          src: i.src.split('/').slice(-1)[0], ok: i.complete && i.naturalWidth > 0
        }))""")
        broken = [i for i in imgs if not i["ok"]]
        print(f"IMG ELEMANLARI: {len(imgs)} adet, kırık: {len(broken)}", broken[:5] if broken else "")

        pg.screenshot(path="/tmp/smoke_home.png")
        b.close()
finally:
    srv.terminate()

print("\n--- 4xx/5xx ISTEKLER ---")
uniq = sorted(set(failed))
print("\n".join(uniq[:15]) if uniq else "YOK")
print(f"--- JS HATALARI ---")
print("\n".join(errors[:10]) if errors else "YOK")
print("\nSONUC:", "TEMIZ" if not uniq and not errors else "SORUN VAR")
sys.exit(0 if not uniq and not errors else 1)
