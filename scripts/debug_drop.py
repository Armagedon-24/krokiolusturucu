# -*- coding: utf-8 -*-
"""Yerleştirme snap'indeki tutarsızlığı canlı teşhis eder."""
import os
from playwright.sync_api import sync_playwright

OUT = "/home/z/my-project/scripts/kaynak-verify-shots"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.route("**/sw.js", lambda r: r.abort())
    page.on("pageerror", lambda e: print("PAGEERROR:", e.message[:300]))
    page.on("console", lambda m: m.type() == "error" and print("CONSOLE:", m.text()[:200]))
    page.goto("http://localhost:8899/", wait_until="networkidle", timeout=45000)
    ok = False
    for _ in range(60):
        try:
            ok = page.evaluate("!!(window.__krokiStore && window.__krokiStage && window.__krokiWallSnap)")
        except Exception:
            ok = False
        if ok:
            break
        page.wait_for_timeout(500)
    assert ok, "kancalar yüklenmedi"
    page.wait_for_timeout(800)

    def palette_dblclick(name):
        img = page.locator(f'img[alt="{name}"]').first
        img.wait_for(state="visible", timeout=15000)
        img.locator("xpath=../..").dblclick()
        page.wait_for_timeout(250)

    def drop_symbol(sym, wx, wy):
        st = page.evaluate("""(() => {
          const s = window.__krokiStage;
          const c = s.container();
          const r = c.getBoundingClientRect();
          return {left: r.left, top: r.top, scale: s.scaleX(), sx: s.x(), sy: s.y()};
        })()""")
        cx = st["left"] + st["sx"] + wx * st["scale"]
        cy = st["top"] + st["sy"] + wy * st["scale"]
        page.evaluate("""([sym, cx, cy]) => {
          const container = window.__krokiStage.container();
          const dt = new DataTransfer();
          dt.setData('symbol', JSON.stringify(sym));
          container.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy}));
        }""", [sym, cx, cy])
        page.wait_for_timeout(300)

    palette_dblclick("İç Duvar (Yatay)")
    palette_dblclick("İç Duvar (Dikey)")
    page.evaluate("""(() => {
      const st = window.__krokiStore.getState();
      const wh = st.objects.find(o => o.symbolId === 'arch-w1i');
      const wv = st.objects.find(o => o.symbolId === 'arch-w1vi');
      st.updateObject(wh.id, { x: 500, y: 400 }, true);
      st.updateObject(wv.id, { x: 850, y: 300 }, true);
    })()""")

    print("drawingArea:", page.evaluate("JSON.stringify(window.__krokiStore.getState().drawingArea)"))

    sym = {"id": "arch-d1l", "name": "Kapı (Sol)", "type": "symbol", "categoryId": "architecture",
           "src": "/assets/symbols/karakalem/inline/arch-d1l.png", "width": 60, "height": 60}
    drop_symbol(sym, 560, 417)

    st = page.evaluate("""(() => {
      const s = window.__krokiStore.getState();
      const ds = s.objects.filter(o => o.symbolId === 'arch-d1l');
      const direct = window.__krokiWallSnap('arch-d1l', 530 + 30, 387 + 30, 60, 60, 0, s.objects.filter(o => o.symbolId !== 'arch-d1l'), undefined, 1);
      return {count: ds.length, doors: ds, direct: direct, walls: s.objects.filter(o => ['arch-w1i','arch-w1vi'].includes(o.symbolId))};
    })()""")
    print("d1l adet:", st["count"])
    for d in st["doors"]:
        print("  d1l:", {k: d.get(k) for k in ("x", "y", "rotation", "width", "height", "zIndex")})
    print("duvarlar:", [{k: w.get(k) for k in ("symbolId", "x", "y", "width", "height")} for w in st["walls"]])
    print("doğrudan snP çağrısı (560,417 girdi):", st["direct"])
    print("beklenen: x=530, y=349.5, rotation=0")

    page.screenshot(path=f"{OUT}/debug-B.png")
    browser.close()
