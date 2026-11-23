#!/usr/bin/env python3
"""YENİ ÇİZİM sonrası activeSceneId debug probe."""
import json
import subprocess
import time

from playwright.sync_api import sync_playwright

PORT = 4176
OLD_EVENT = {
    "id": "scene-eski-olay-1",
    "name": "Olay Yeri Kroki- 2024/123 (12:00:00)",
    "type": "kroki",
    "objects": [], "backgroundImage": None,
    "drawingArea": {"x": 17, "y": 167, "width": 966, "height": 1126},
    "projectInfo": {"type": "kroki", "eventName": "ESKİ OLAY ADI", "reportNo": "2024/123",
                    "address": "Eski", "date": "2024-01-01", "sketchedBy": "Eski Uzman",
                    "expert2": "", "description": ""},
}
MOCK = {"timestamp": int(time.time()*1000), "_revAt": int(time.time()*1000),
        "scenes": [OLD_EVENT], "activeSceneId": OLD_EVENT["id"],
        "projectState": {"projectInfo": OLD_EVENT["projectInfo"]}, "adminSettings": {}}

srv = subprocess.Popen(["npx", "vite", "preview", "--port", str(PORT), "--strictPort"],
                       cwd="/home/z/my-project/master-src",
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(4)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.route("**/kroki_config_v2*", lambda r: r.fulfill(
            status=200, content_type="application/json", body=json.dumps(MOCK)))
        pg.goto(f"http://localhost:{PORT}", wait_until="networkidle", timeout=60000)
        time.sleep(3)

        def snap(label):
            v = pg.evaluate("""() => {
              const s = window.__krokiStore.getState();
              return { asid: s.activeSceneId, nsc: (s.scenes||[]).length,
                       narc: (s.archiveScenes||[]).length, nobj: (s.objects||[]).length };
            }""")
            print(f"{label}: {v}")

        snap("acilis")
        pg.evaluate("""() => {
          const s = window.__krokiStore.getState();
          const old = (s.archiveScenes || []).find(x => x.projectInfo?.reportNo === '2024/123');
          if (old) s.switchScene(old.id);
        }""")
        time.sleep(1)
        snap("switchScene sonrasi")
        pg.click('[aria-label="Olay Yönetimi Paneli"]')
        time.sleep(3)
        snap("modal acik")
        pg.locator("div.max-w-4xl button", has_text="YENİ ÇİZİM").click()
        time.sleep(0.5)
        pg.get_by_role("button", name="EVET, DEVAM ET").click()
        time.sleep(0.3)
        snap("yeni cizim t+0.3")
        time.sleep(2)
        snap("yeni cizim t+2.3")
        b.close()
finally:
    srv.terminate()
