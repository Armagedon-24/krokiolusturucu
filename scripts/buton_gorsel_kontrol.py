#!/usr/bin/env python3
"""Modal açıkken footer butonlarının görsel doğrulaması (ekran görüntüsü)."""
import json
import subprocess
import time

from playwright.sync_api import sync_playwright

PORT = 4177
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
        pg.route("**/res.cloudinary.com/**", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))
        pg.route("**/kroki_config_v2*", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))
        pg.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=60000)
        time.sleep(3)
        pg.click('[aria-label="Olay Yönetimi Paneli"]')
        time.sleep(4)
        # Footer alanını yakınlaştırılmış yakala + tüm modalı yakala
        pg.locator("div.max-w-4xl").screenshot(path="/tmp/modal-full.png")
        footer = pg.locator("div.max-w-4xl > div").last
        footer.screenshot(path="/tmp/modal-footer.png")
        b.close()
finally:
    srv.terminate()
print("OK: /tmp/modal-full.png, /tmp/modal-footer.png")
