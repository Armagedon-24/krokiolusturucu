# -*- coding: utf-8 -*-
"""F parite testinin kırpımlarını görselleştirir."""
from playwright.sync_api import sync_playwright

OUT = "/home/z/my-project/scripts/kaynak-verify-shots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.route("**/sw.js", lambda r: r.abort())
    page.goto("http://localhost:8899/", wait_until="networkidle", timeout=45000)
    for _ in range(60):
        if page.evaluate("!!(window.__krokiStore && window.__krokiStage && window.__krokiWallSnap)"):
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(500)

    # Tek kapı koy, yalnız köşeye taşı, dikey çevir
    page.evaluate("""(async () => {
      const st = window.__krokiStore.getState();
      st.addObject({id: 'test-d1l', symbolId: 'arch-d1l', categoryId: 'architecture', type: 'symbol',
                    name: 'Kapı (Sol)', src: '/assets/symbols/karakalem/inline/arch-d1l.png',
                    x: 150, y: 700, width: 60, height: 60, rotation: 0, scaleX: 1, scaleY: -1,
                    distanceColor: '#000000'});
      // resmin yüklenmesini bekle
      await new Promise(r => setTimeout(r, 600));
    })()""")
    page.wait_for_timeout(800)

    result = page.evaluate("""(async () => {
      const store = window.__krokiStore.getState();
      const obj = store.objects.find(o => o.symbolId === 'arch-d1l');
      const stage = window.__krokiStage;
      const node = Array.from(stage.find('Group')).find(n =>
        Math.abs(n.x() - obj.x) < 1 && Math.abs(n.y() - obj.y) < 1);
      if (!node) return {ok: false, why: 'node yok'};
      const keep = node.getLayer();
      const hidden = [];
      stage.getLayers().forEach(l => { if (l !== keep && l.visible()) { l.visible(false); hidden.push(l); } });
      keep.batchDraw();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const stageCv = stage.toCanvas({pixelRatio: 1});
      hidden.forEach(l => l.visible(true));
      keep.batchDraw();
      const w = Math.round(obj.width), h = Math.round(obj.height);
      const img = new Image(); img.src = obj.src;
      await new Promise(res => { img.onload = res; img.onerror = () => res(null); });
      const imgOk = !!(img && img.naturalWidth);
      const drawWith = (shift) => {
        const off = document.createElement('canvas');
        off.width = stage.width(); off.height = stage.height();
        const ctx = off.getContext('2d');
        const rot = ((obj.rotation || 0) % 360 + 360) % 360 * Math.PI / 180;
        const ox = (obj.scaleX === -1) ? w : 0;
        const oy = (obj.scaleY === -1) ? h : 0;
        ctx.translate(obj.x + (shift ? ox : 0), obj.y + (shift ? oy : 0));
        ctx.rotate(rot); ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1); ctx.translate(-ox, -oy);
        if (imgOk) ctx.drawImage(img, 0, 0, w, h);
        return off;
      };
      // kırpımları kaydet
      const crop = (cv) => {
        const c = document.createElement('canvas');
        c.width = w + 4; c.height = h + 4;
        c.getContext('2d').drawImage(cv, obj.x - 2, obj.y - 2, w + 4, h + 4, 0, 0, w + 4, h + 4);
        return c.toDataURL('image/png');
      };
      return {ok: true, imgOk, obj: {x: obj.x, y: obj.y, scaleX: obj.scaleX, scaleY: obj.scaleY, src: obj.src},
              nodePos: {x: node.x(), y: node.y()},
              stageCrop: crop(stageCv), newCrop: crop(drawWith(0)), oldCrop: crop(drawWith(1))};
    })()""")
    print("ok:", result["ok"], "| imgOk:", result.get("imgOk"), "| obj:", result.get("obj"), "| node:", result.get("nodePos"))

    import base64
    for name, key in (("f-stage.png", "stageCrop"), ("f-new.png", "newCrop"), ("f-old.png", "oldCrop")):
        if result.get(key):
            with open(f"{OUT}/{name}", "wb") as f:
                f.write(base64.b64decode(result[key].split(",")[1]))
            print("kaydedildi:", name)
    browser.close()
