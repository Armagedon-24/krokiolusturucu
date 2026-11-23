# -*- coding: utf-8 -*-
"""Drop koordinat zincirini yeni formülle teşhis eder."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.route("**/sw.js", lambda r: r.abort())
    logs = []
    page.on("console", lambda m: logs.append(m.text))
    page.on("pageerror", lambda e: print("PAGEERROR:", e.message[:200]))
    page.goto("http://localhost:8899/", wait_until="networkidle", timeout=45000)
    for _ in range(60):
        if page.evaluate("!!(window.__krokiStore && window.__krokiStage && window.__krokiWallSnap)"):
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(500)

    info = page.evaluate("""(() => {
      const s = window.__krokiStage;
      const content = s.content;
      const rect = content.getBoundingClientRect();
      return {left: rect.left, top: rect.top, rw: rect.width, rh: rect.height,
              cw: content.clientWidth, ch: content.clientHeight,
              sxs: rect.width / content.clientWidth,
              sys: rect.height / content.clientHeight,
              sw: s.width(), sh: s.height()};
    })()""")
    print("content ölçüleri:", info)

    # Konva pointer hesabını sarmala
    page.evaluate("""(() => {
      const stage = window.__krokiStage;
      const orig = stage.setPointersPositions.bind(stage);
      stage.setPointersPositions = (e) => {
        orig(e);
        const pp = stage.getPointerPosition();
        console.log('DBG pointer=' + (pp ? JSON.stringify({x: Math.round(pp.x*100)/100, y: Math.round(pp.y*100)/100}) : 'null'));
      };
    })()""")

    # Duvarları yerleştir + taşı
    img = page.locator('img[alt="İç Duvar (Yatay)"]').first
    img.wait_for(state="visible", timeout=15000)
    img.locator("xpath=../..").dblclick()
    page.wait_for_timeout(250)
    page.evaluate("""(() => {
      const st = window.__krokiStore.getState();
      const wh = st.objects.find(o => o.symbolId === 'arch-w1i');
      st.updateObject(wh.id, { x: 500, y: 400 }, true);
    })()""")
    page.wait_for_timeout(200)
    print("duvar:", page.evaluate("""(() => {
      const w = window.__krokiStore.getState().objects.find(o => o.symbolId === 'arch-w1i');
      return {x: w.x, y: w.y, width: w.width, height: w.height};
    })()"""))

    # Yeni formülle client hesapla ve drop gönder
    wx, wy = 560, 417
    cx = info["left"] + wx * info["sxs"]
    cy = info["top"] + wy * info["sys"]
    print("gönderilen client:", round(cx, 2), round(cy, 2), "(beklenen pointer:", wx, wy, ")")
    page.evaluate("""([sym, cx, cy]) => {
      const container = window.__krokiStage.container();
      const dt = new DataTransfer();
      dt.setData('symbol', JSON.stringify(sym));
      container.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy}));
    }""", [{"id": "arch-d1l", "name": "Kapı (Sol)", "type": "symbol", "categoryId": "architecture",
            "src": "/assets/symbols/karakalem/inline/arch-d1l.png", "width": 60, "height": 60}, cx, cy])
    page.wait_for_timeout(400)

    for l in logs:
        if l.startswith("DBG"):
            print(l)
    print("d1l:", page.evaluate("""(() => {
      const o = window.__krokiStore.getState().objects.find(o => o.symbolId === 'arch-d1l');
      return o ? {x: o.x, y: o.y, rotation: o.rotation, skipGridIzi: o.skipGrid} : null;
    })()"""))
    browser.close()
