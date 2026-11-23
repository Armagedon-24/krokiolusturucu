#!/usr/bin/env python3
"""Açılış hızı ölçümü + senaryo yükleme (dinamik import) çalışma-anı doğrulaması.

1. Boş önbellekle açılış: istek sayısı, aktarılan KB, DOMContentLoaded/load süreleri.
2. ÖRNEK OLAYLAR sekmesi açılır → bir senaryo yüklenir → tuval nesneleri oluşmalı
   (krokiScenarios dinamik import yolu çalışıyor mu?).
3. JS hatası sıfır.
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PORT = 4178
failures = []


def check(name, cond, detail=""):
    status = "OK " if cond else "HATA"
    print(f"[{status}] {name}" + (f" -> {detail}" if detail else ""))
    if not cond:
        failures.append(f"{name}: {detail}")


srv = subprocess.Popen(
    ["npx", "vite", "preview", "--port", str(PORT), "--strictPort"],
    cwd="/home/z/my-project/master-src",
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(4)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        pg.route("**/res.cloudinary.com/**", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))
        pg.route("**/kroki_config_v2*", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))

        # Ağ ölçümü (JS/CSS/HTML)
        net = {"bytes": 0, "count": 0, "js_bytes": 0}
        def on_response(resp):
            url = resp.url
            try:
                body = resp.body()
            except Exception:
                return
            net["count"] += 1
            net["bytes"] += len(body)
            if ".js" in url.split("?")[0].split("/")[-1]:
                net["js_bytes"] += len(body)
        pg.on("response", on_response)

        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        t0 = time.time()
        pg.goto(f"http://localhost:{PORT}", wait_until="domcontentloaded", timeout=60000)
        dcl = time.time() - t0
        pg.wait_for_selector("canvas", timeout=30000)
        canvas_at = time.time() - t0
        t1 = time.time()
        pg.wait_for_load_state("load", timeout=30000)
        load_ev = time.time() - t1
        time.sleep(1.5)

        print(f"AÇILIŞ: DOMContentLoaded={dcl:.2f}s, canvas hazır={canvas_at:.2f}s, load+{load_ev:.2f}s")
        print(f"AĞ: {net['count']} istek, toplam {net['bytes']/1024:.0f} KiB (js {net['js_bytes']/1024:.0f} KiB)")

        obj_count_0 = pg.evaluate("window.__krokiStore?.getState().objects.length")
        # TASARIM GEREĞİ: açılışta tuval BOŞ (restoreFromCloud→clearCanvas, form temiz başlar)
        check("Açılış: tuval temiz başlıyor (tasarım gereği boş)", obj_count_0 == 0, f"nesne={obj_count_0}")

        # ÖRNEK OLAYLAR sekmesi → senaryo kartı → tuvale aktar
        pg.locator("button", has_text="ÖRNEK OLAYLAR").first.click()
        time.sleep(2)
        pg.locator("button", has_text="KROKİYİ TUVALE AKTAR").first.click()
        time.sleep(3)

        obj_count_1 = pg.evaluate("window.__krokiStore?.getState().objects.length")
        check("Senaryo yükleme: kroki nesneleri oluştu (dinamik import yolu)", obj_count_1 > 10,
              f"önce={obj_count_0} sonra={obj_count_1}")
        ev = pg.evaluate("window.__krokiStore?.getState().projectInfo.eventName || ''")
        check("Senaryo yükleme: olay bilgisi doldu", len(ev) > 0, f"eventName={ev!r}")

        check("JS hatası yok", len(errors) == 0, "; ".join(errors[:3]))
        b.close()
finally:
    srv.terminate()

print()
if failures:
    print("SONUÇ: BAŞARISIZ")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print("SONUÇ: TÜM TESTLER GEÇTİ")
