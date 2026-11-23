#!/usr/bin/env python3
"""'Kırık' görünen img elemanlarının tam src/loading durumu — lazily yüklenen
Cloudinary önizlemeleri mi, gerçekten kırık mı?"""
import subprocess
import time

from playwright.sync_api import sync_playwright

PORT = 4174
srv = subprocess.Popen(
    ["npx", "vite", "preview", "--port", str(PORT), "--strictPort"],
    cwd="/home/z/my-project/master-src",
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(4)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        reqs = []
        pg.on("request", lambda r: reqs.append(r.url) if r.resource_type == "image" else None)
        pg.on("response", lambda r: reqs.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        pg.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=60000)
        time.sleep(2)
        info = pg.evaluate("""() => {
          const all = Array.from(document.images);
          const broken = all.filter(i => !(i.complete && i.naturalWidth > 0));
          const sample = broken.slice(0, 6).map(i => ({
            loading: i.loading,
            complete: i.complete,
            nw: i.naturalWidth,
            src: i.getAttribute('src') ? i.getAttribute('src').slice(0, 90) : '(boş)',
            cur: i.currentSrc ? i.currentSrc.slice(0, 90) : '(istem-yok)',
            fetchpriority: i.fetchPriority || '-',
          }));
          const local = broken.filter(i => (i.getAttribute('src')||'').startsWith('/')).length;
          const cloud = broken.filter(i => /cloudinary|http/.test(i.getAttribute('src')||'')).length;
          const other = broken.length - local - cloud;
          return { toplam: all.length, kirik: broken.length, local, cloud, other, sample };
        }""")
        for k, v in info.items():
            if k != "sample":
                print(k, "=", v)
        for s in info["sample"]:
            print("  ", s)
        b.close()
finally:
    srv.terminate()
