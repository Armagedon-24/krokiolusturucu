# -*- coding: utf-8 -*-
"""Kaynak derlemesinin (kaynak/dist) kapı-duvar davranışını Playwright ile doğrular — v2."""
import json, math, os, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8899/"
OUT = "/home/z/my-project/scripts/kaynak-verify-shots"
os.makedirs(OUT, exist_ok=True)

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (("  | " + str(detail)) if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.route("**/sw.js", lambda r: r.abort())
    page.on("pageerror", lambda e: print("PAGEERROR:", e.message[:200]))
    page.goto(BASE, wait_until="networkidle", timeout=45000)
    page.wait_for_function("window.__krokiStore && window.__krokiStage", timeout=30000)
    page.wait_for_timeout(800)

    def objs():
        return page.evaluate("window.__krokiStore.getState().objects")

    def arch_objs():
        return [o for o in objs() if (o.get("symbolId") or "").startswith("arch-")]

    def stage_info():
        return page.evaluate("""(() => {
          const s = window.__krokiStage;
          const c = s.container();
          const r = c.getBoundingClientRect();
          // Uygulama sahne konteynerini CSS ile ölçekler (mantık w × görsel w oran);
          // Konva gerçek işaretçi olaylarında bu telafiyi yapar (setPointersPositions).
          return {left: r.left, top: r.top, cw: r.width, ch: r.height,
                  sw: s.width(), sh: s.height(), scale: s.scaleX(), sx: s.x(), sy: s.y()};
        })()""")

    def to_client(wx, wy):
        st = stage_info()
        kx = st["cw"] / st["sw"]
        ky = st["ch"] / st["sh"]
        return st["left"] + (wx * st["scale"] + st["sx"]) * kx, st["top"] + (wy * st["scale"] + st["sy"]) * ky

    def palette_dblclick(name):
        img = page.locator(f'img[alt="{name}"]').first
        img.wait_for(state="visible", timeout=15000)
        img.locator("xpath=../..").dblclick()
        page.wait_for_timeout(250)

    def drop_symbol(sym, wx, wy):
        cx, cy = to_client(wx, wy)
        page.evaluate("""([sym, cx, cy]) => {
          const container = window.__krokiStage.container();
          const dt = new DataTransfer();
          dt.setData('symbol', JSON.stringify(sym));
          container.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy}));
        }""", [sym, cx, cy])
        page.wait_for_timeout(300)

    # ---------- A) Palet boyutları + duvarları ayır ----------
    palette_dblclick("İç Duvar (Yatay)")
    palette_dblclick("İç Duvar (Dikey)")
    page.wait_for_timeout(200)
    # Duvarları üste taşı (yerleştirme noktası 250,250 çakışmasın)
    page.evaluate("""(() => {
      const st = window.__krokiStore.getState();
      const wh = st.objects.find(o => o.symbolId === 'arch-w1i');
      const wv = st.objects.find(o => o.symbolId === 'arch-w1vi');
      st.updateObject(wh.id, { x: 500, y: 400 }, true);
      st.updateObject(wv.id, { x: 850, y: 300 }, true);
    })()""")
    page.wait_for_timeout(200)
    palette_dblclick("Kapı (Sağ)")
    page.wait_for_timeout(300)

    a = arch_objs()
    wallH = next((o for o in a if o.get("symbolId") == "arch-w1i"), None)
    wallV = next((o for o in a if o.get("symbolId") == "arch-w1vi"), None)
    doorA = next((o for o in a if o.get("symbolId") == "arch-d1r"), None)
    check("A1 yatay duvar 200×10", wallH and wallH["width"] == 200 and wallH["height"] == 10,
          wallH and f'{wallH["width"]}x{wallH["height"]}')
    check("A2 dikey duvar 10×200", wallV and wallV["width"] == 10 and wallV["height"] == 200,
          wallV and f'{wallV["width"]}x{wallV["height"]}')
    check("A3 kapı 60×60", doorA and doorA["width"] == 60 and doorA["height"] == 60,
          doorA and f'{doorA["width"]}x{doorA["height"]}')

    wy_center = wallH["y"] + 5           # yatay duvar merkez çizgisi (400+5)
    vx_center = wallV["x"] + 5           # dikey duvar merkez çizgisi (850+5)

    # ---------- B) Yatay duvara bırakma: kutu merkezi çizginin 12 px altında ----------
    sym_d1l = {"id": "arch-d1l", "name": "Kapı (Sol)", "type": "symbol",
               "categoryId": "architecture",
               "src": "/assets/symbols/karakalem/inline/arch-d1l.png",
               "width": 60, "height": 60}
    drop_symbol(sym_d1l, 560, wy_center + 12)
    page.wait_for_timeout(250)
    d1l = next((o for o in objs() if o.get("symbolId") == "arch-d1l"), None)
    if d1l:
        casing_y = d1l["y"] + 60 * 0.925
        check("B1 yatay snap: açı 0", abs(((d1l["rotation"] or 0) % 360)) < 0.001, d1l["rotation"])
        check("B2 yatay snap: kasa-duvar 0 px", abs(casing_y - wy_center) < 0.01,
              f"fark={casing_y - wy_center:.4f}px")
        check("B3 yatay snap: duvar boyu içinde", 500 <= d1l["x"] and (d1l["x"] + 60) <= 700,
              f'x={d1l["x"]:.1f}')
    else:
        check("B yatay snap", False, "d1l bulunamadı")

    # ---------- C) Dikey duvara bırakma: kutu merkezi çizginin 14 px sağında ----------
    sym_d1r = {"id": "arch-d1r", "name": "Kapı (Sağ)", "type": "symbol",
               "categoryId": "architecture",
               "src": "/assets/symbols/karakalem/inline/arch-d1r.png",
               "width": 60, "height": 60}
    drop_symbol(sym_d1r, vx_center + 14, 400)
    page.wait_for_timeout(250)
    d1rs = [o for o in objs() if o.get("symbolId") == "arch-d1r"]
    d1rB = max(d1rs, key=lambda o: o.get("zIndex", 0))
    if d1rB is not doorA:
        rot = (d1rB["rotation"] or 0) % 360
        check("C1 dikey snap: açı 90", abs(rot - 90) < 0.001, rot)
        rr = rot * math.pi / 180
        casing_x = d1rB["x"] + 30 * math.cos(rr) - 55.5 * math.sin(rr)
        check("C2 dikey snap: kasa-duvar 0 px", abs(casing_x - vx_center) < 0.01,
              f"fark={casing_x - vx_center:.4f}px")
        check("C3 dikey snap: duvar boyu içinde",
              300 <= (d1rB["y"] + 30) and (d1rB["y"] + 30) <= 500,
              f'merkez y={d1rB["y"] + 30:.1f}')
    else:
        check("C dikey snap", False, "yeni d1r bulunamadı")

    page.screenshot(path=f"{OUT}/01-canvas-snap-sonrasi.png")

    # ---------- D) Gerçek fare sürüklemesi ----------
    # Önce d1l'i uzağa taşı (yakalama noktası tek olsun), sonra serbest kapıyı duvara sürükle
    page.evaluate("""(() => {
      const st = window.__krokiStore.getState();
      const o = st.objects.find(o => o.symbolId === 'arch-d1l');
      st.updateObject(o.id, { x: 250, y: 750 }, true);
    })()""")
    page.wait_for_timeout(200)
    cx, cy = to_client(doorA["x"] + 30, doorA["y"] + 30)
    page.mouse.move(cx, cy)
    page.mouse.down()
    tx, ty = to_client(560, wy_center + 8)
    for i in range(1, 8):
        page.mouse.move(cx + (tx - cx) * i / 7, cy + (ty - cy) * i / 7)
        page.wait_for_timeout(30)
    page.mouse.up()
    page.wait_for_timeout(300)
    doorAd = next((o for o in objs() if o["id"] == doorA["id"]))
    casing_y = doorAd["y"] + 60 * 0.925
    check("D1 sürükleme miknatısı: kasa-duvar 0 px", abs(casing_y - wy_center) < 0.01,
          f"fark={casing_y - wy_center:.4f}px")
    check("D2 sürükleme miknatısı: açı 0", abs(((doorAd["rotation"] or 0) % 360)) < 0.001,
          doorAd["rotation"])
    # Duvardan uzağa sürükle → serbest kalmalı (bırakılan yer aynen kalsın)
    cx, cy = to_client(doorAd["x"] + 30, doorAd["y"] + 30)
    page.mouse.move(cx, cy)
    page.mouse.down()
    tx, ty = to_client(250, 620)
    for i in range(1, 8):
        page.mouse.move(cx + (tx - cx) * i / 7, cy + (ty - cy) * i / 7)
        page.wait_for_timeout(30)
    page.mouse.up()
    page.wait_for_timeout(300)
    doorAe = next((o for o in objs() if o["id"] == doorA["id"]))
    free = math.hypot(doorAe["x"] - 220, doorAe["y"] - 590) < 12  # hedef (250,620) - yarım kutu; 10px izgara toleransı
    check("D3 duvardan uzaklaşınca serbest + bırakıldığı yerde kalır", free,
          f'konum=({doorAe["x"]:.0f},{doorAe["y"]:.0f}) beklenen≈(220,590)')

    # ---------- E) Kapı seçili + panel görüntüsü ----------
    cx, cy = to_client(doorAe["x"] + 30, doorAe["y"] + 30)
    page.mouse.click(cx, cy)
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/02-kapi-secili-panel.png")

    # ---------- F) Ayna-PDF paritesi ----------
    # d1l'i yalnız bir köşeye taşı, node'u konumdan bul, dikey çevir, karşılaştır
    page.evaluate("""(() => {
      const st = window.__krokiStore.getState();
      const o = st.objects.find(o => o.symbolId === 'arch-d1l');
      st.updateObject(o.id, { x: 150, y: 700 }, true);
    })()""")
    page.wait_for_timeout(300)
    parity = page.evaluate("""(async () => {
      const store = window.__krokiStore.getState();
      const obj = store.objects.find(o => o.symbolId === 'arch-d1l');
      const stage = window.__krokiStage;
      const node = Array.from(stage.find('Group')).find(n =>
        Math.abs(n.x() - obj.x) < 1 && Math.abs(n.y() - obj.y) < 1);
      if (!node) return {ok: false, why: 'node yok'};
      // Konva'nın kapı node'unun YEREL (ızgarasız) çizimi
      const nodeCv = node.toCanvas({pixelRatio: 1});
      const w = Math.max(1, Math.round(obj.width)), h = Math.max(1, Math.round(obj.height));
      const img = new Image(); img.src = obj.src;
      await new Promise(res => { img.onload = res; img.onerror = res; });
      // İÇ transform taklidi (dış dünya kayması hariç): R·S·T(-ox,-oy) + P9 bant kuralı
      const drawInner = () => {
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const ctx = off.getContext('2d');
        const rot = ((obj.rotation || 0) % 360 + 360) % 360 * Math.PI / 180;
        const ox = (obj.scaleX === -1) ? w : 0;
        const oy = (obj.scaleY === -1) ? h : 0;
        ctx.rotate(rot); ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1); ctx.translate(-ox, -oy);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, obj.scaleY === -1 ? 0 : h * 0.85, w, h * 0.15);
        ctx.drawImage(img, 0, 0, w, h);
        return off;
      };
      // DÜNYA düzleminde KAYMA KANITI: eski dış transform T(x+ox,y+oy) ile çizim,
      // yeninin (w,h) kaydırılmışıyla birebir çakışmalı mı?
      const drawWorld = (shift) => {
        const off = document.createElement('canvas');
        off.width = stage.width(); off.height = stage.height();
        const ctx = off.getContext('2d');
        const rot = ((obj.rotation || 0) % 360 + 360) % 360 * Math.PI / 180;
        const ox = (obj.scaleX === -1) ? w : 0;
        const oy = (obj.scaleY === -1) ? h : 0;
        ctx.translate(obj.x + (shift ? ox : 0), obj.y + (shift ? oy : 0));
        ctx.rotate(rot); ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1); ctx.translate(-ox, -oy);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, obj.scaleY === -1 ? 0 : h * 0.85, w, h * 0.15);
        ctx.drawImage(img, 0, 0, w, h);
        return {cv: off, ox, oy};
      };
      const diffData = (a, b) => {
        let diff = 0, n = 0;
        for (let i = 0; i < a.length; i += 4) { n++; if (Math.abs(a[i]-b[i]) > 40 || Math.abs(a[i+1]-b[i+1]) > 40) diff++; }
        return diff / n;
      };
      const newLocal = diffData(nodeCv.getContext('2d').getImageData(0, 0, Math.min(w, nodeCv.width), Math.min(h, nodeCv.height)).data,
                                drawInner().getContext('2d').getImageData(0, 0, w, h).data);
      const newW = drawWorld(0), oldW = drawWorld(1);
      const shiftEq = diffData(newW.cv.getContext('2d').getImageData(Math.round(obj.x), Math.round(obj.y), w, h).data,
                               oldW.cv.getContext('2d').getImageData(Math.round(obj.x + oldW.ox), Math.round(obj.y + oldW.oy), w, h).data);
      return {ok: true, newLocal: newLocal, shiftEq: shiftEq};
    })()""")
    if parity.get("ok"):
        check("F1 ayna-PDF parite: yeni iç transform Konva ile örtüşüyor", parity["newLocal"] < 0.05,
              f"fark={parity['newLocal']:.4f}")
        check("F2 eski transform = yeninin tam (w,h) kaydırılmışı → kayma kanıtlandı",
              parity["shiftEq"] < 0.05, f"fark={parity['shiftEq']:.4f}")
    else:
        check("F ayna-PDF parite", False, parity.get("why"))

    page.screenshot(path=f"{OUT}/03-final.png")
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\nTOPLAM: {len(results)} test, {len(fails)} başarısız")
sys.exit(1 if fails else 0)
