#!/usr/bin/env python3
"""OLAY YÖNETİMİ eski bilgi resurrection düzeltmesi — uçtan uca tarayıcı testi.

Senaryo:
  1. Bulut, ESKİ OLAY sahnesi + eski projectState.projectInfo döndürecek şekilde sahtelenir.
  2. Uygulama açılır (açılış restore + clearCanvas) → form BOŞ olmalı.
  3. Kullanıcı yeni çalışma bilgisi yazar + tuvale nesne ekler.
  4. OLAY YÖNETİMİ açılır (sessiz bulut senkronu: preserveCurrentDrawing) →
     form YENİ ÇALIŞMA kalmalı, eski olay GELMEMELİ; nesne durmalı; arşiv listesinde
     eski olay GÖRÜNMELİ (arşiv tazelenmesi bozulmamalı).
  5. Listedeki eski olaya tıklanır → switchScene ile açılır (form eski bilgilerle dolar) —
     eski dosyayı açma akışı sağlam olmalı.
  6. YENİ ÇİZİM onaylanır → form + tuval tamamen boş olmalı.
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PORT = 4175
BASE = f"http://localhost:{PORT}"

OLD_EVENT = {
    "id": "scene-eski-olay-1",
    "name": "Olay Yeri Kroki- 2024/123 (12:00:00)",
    "type": "kroki",
    "objects": [],
    "backgroundImage": None,
    "drawingArea": {"x": 17, "y": 167, "width": 966, "height": 1126},
    "projectInfo": {
        "type": "kroki",
        "eventName": "ESKİ OLAY ADI",
        "reportNo": "2024/123",
        "address": "Eski Cadde, Eski Mahalle",
        "date": "2024-01-01",
        "sketchedBy": "Eski Uzman",
        "expert2": "Eski Uzman 2",
        "description": "Eski olay açıklaması",
    },
}
MOCK_CONFIG = {
    "timestamp": int(time.time() * 1000),
    "_revAt": int(time.time() * 1000),
    "scenes": [OLD_EVENT],
    "activeSceneId": OLD_EVENT["id"],
    "projectState": {"projectInfo": OLD_EVENT["projectInfo"]},
    "adminSettings": {},
}

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
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        pg.route("**/kroki_config_v2*", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(MOCK_CONFIG)))
        js_errors = []
        pg.on("pageerror", lambda e: js_errors.append(str(e)))
        pg.goto(BASE, wait_until="networkidle", timeout=60000)
        time.sleep(3)

        st = lambda key: pg.evaluate(f"window.__krokiStore?.getState()?.{key}")
        pi = lambda key: pg.evaluate(f"window.__krokiStore?.getState()?.projectInfo?.{key}")

        # 1) Açılışta form boş olmalı (clearCanvas varsayılanları)
        check("Açılış: form boş", pi("eventName") == "" and pi("reportNo") == "",
              f"eventName={pi('eventName')!r} reportNo={pi('reportNo')!r}")

        # 2) Yeni çalışma bilgisi + tuval nesnesi
        pg.evaluate("""() => {
          const s = window.__krokiStore.getState();
          s.updateProjectInfo({ eventName: 'YENİ ÇALIŞMA', reportNo: '2026/999', sketchedBy: 'Yeni Uzman' });
          s.addObject({ id: 'yeni-nesne-1', type: 'rect', name: 'Kare', x: 400, y: 400, width: 50, height: 50 });
        }""")
        time.sleep(0.5)

        # 3) OLAY YÖNETİMİ aç
        pg.click('[aria-label="Olay Yönetimi Paneli"]')
        time.sleep(4)  # modal + sessiz bulut senkronu (preserveCurrentDrawing)

        # Form eski olayı GÖSTERMEMELİ
        check("Modal açılışı: form eski olayı getirmiyor", pi("eventName") == "YENİ ÇALIŞMA",
              f"eventName={pi('eventName')!r} (beklenen: YENİ ÇALIŞMA)")
        check("Modal açılışı: rapor no korunuyor", pi("reportNo") == "2026/999",
              f"reportNo={pi('reportNo')!r}")
        check("Modal açılışı: çizilen nesne duruyor", pg.evaluate(
            "window.__krokiStore.getState().objects.some(o => o.id === 'yeni-nesne-1')"))

        # Arşiv listesi yine de eski olayı GÖSTERMELİ (arşiv tazelenmesi bozulmadı)
        archive_has_old = pg.evaluate(
            "(window.__krokiStore.getState().archiveScenes || []).some(s => s.projectInfo?.reportNo === '2024/123')")
        check("Arşiv listesi eski olayı gösteriyor (arşiv işlevi bozulmadı)", archive_has_old)

        # 4) Listedeki eski olaya tıkla → eski dosya açılır (meşru akış)
        pg.evaluate("""() => {
          const s = window.__krokiStore.getState();
          const old = (s.archiveScenes || []).find(x => x.projectInfo?.reportNo === '2024/123');
          if (old) s.switchScene(old.id);
        }""")
        time.sleep(1)
        check("Eski olayı listeden açma çalışıyor", pi("reportNo") == "2024/123",
              f"reportNo={pi('reportNo')!r}")

        # 5) YENİ ÇİZİM (modal içindeki buton) → onayla → her şey boş
        pg.locator("div.max-w-4xl button", has_text="YENİ ÇİZİM").click()
        time.sleep(0.5)
        pg.get_by_role("button", name="EVET, DEVAM ET").click()
        time.sleep(1)
        ok_empty = (pi("eventName") == "" and pi("reportNo") == "" and pi("sketchedBy") == ""
                    and pi("address") == "" and pi("description") == "" and pi("expert2") == "")
        check("YENİ ÇİZİM: tüm form alanları boş", ok_empty,
              f"eventName={pi('eventName')!r} reportNo={pi('reportNo')!r} address={pi('address')!r}")
        check("YENİ ÇİZİM: tuval boş", pg.evaluate("(window.__krokiStore.getState().objects || []).length === 0"))
        # Not: PageControlBar, sahne listesi boşalınca bilinçli olarak temiz 'Sayfa 1' yaratır;
        # önemli olan (a) eski olaya bağ kalmaması ve (b) yeni sayfanın TEMİZ bilgi taşımasıdır.
        check("YENİ ÇİZİM: eski olaya bağ kalmadı",
              pg.evaluate("window.__krokiStore.getState().activeSceneId !== 'scene-eski-olay-1'"))
        check("YENİ ÇİZİM: yeni sayfa bilgisi temiz",
              pg.evaluate("(window.__krokiStore.getState().scenes || []).every(s => !(s.projectInfo?.eventName || s.projectInfo?.reportNo))"))

        # 6) Modalı tekrar aç → form boş KALMALI (kullanıcının asıl şikayeti)
        pg.click('[aria-label="Olay Yönetimi Paneli"]')
        time.sleep(4)
        check("Modal tekrar açılış: form hâlâ boş", pi("eventName") == "" and pi("reportNo") == "",
              f"eventName={pi('eventName')!r} reportNo={pi('reportNo')!r}")

        pg.screenshot(path="/tmp/olay-modal-test.png")
        check("JS hatası yok", len(js_errors) == 0, "; ".join(js_errors[:3]))
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
