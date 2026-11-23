#!/usr/bin/env python3
"""KAYDET / PDF OLUŞTUR buton ayrımı — uçtan uca tarayıcı testi.

Senaryo:
  1. Uygulama açılır, OLAY YÖNETİMİ paneli açılır.
  2. Footer'da iki ayrı buton olmalı: "BİLGİLERİ KAYDET" ve "PDF OLUŞTUR";
     eski birleşik "Kaydet ve PDF Oluştur" etiketi KALMAMALI.
  3. BİLGİLERİ KAYDET: arşive yeni dosya eklenmeli, PDF İNDİRİLMEMELİ,
     buton "KAYDEDİLDİ" geri bildirimi vermeli, modal açık kalmalı.
  4. PDF OLUŞTUR: PDF indirilmeli, arşive YENİ DOSYA EKLENMEMELİ, modal kapanmalı.
  5. Hiçbir JS hatası olmamalı.
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

PORT = 4176
BASE = f"http://localhost:{PORT}"

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
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        pg = ctx.new_page()
        # Bulut uçlarını sahtele (gerçek ağ çağrısı olmasın)
        pg.route("**/res.cloudinary.com/**", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))
        pg.route("**/kroki_config_v2*", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps({})))
        js_errors = []
        pg.on("pageerror", lambda e: js_errors.append(str(e)))

        downloads = []
        pg.on("download", lambda d: downloads.append(d.suggested_filename))

        pg.goto(BASE, wait_until="networkidle", timeout=60000)
        time.sleep(3)

        st = lambda key: pg.evaluate(f"window.__krokiStore?.getState()?.{key}")

        # 1) OLAY YÖNETİMİ panelini aç
        pg.click('[aria-label="Olay Yönetimi Paneli"]')
        time.sleep(4)

        # 2) İki ayrı buton var mı? Eski birleşik etiket kalktı mı?
        body_text = pg.locator("div.max-w-4xl").inner_text()
        has_save = pg.locator("div.max-w-4xl button", has_text="BİLGİLERİ KAYDET").count() == 1
        has_pdf = pg.locator("div.max-w-4xl button", has_text="PDF OLUŞTUR").count() == 1
        combined_gone = "KAYDET VE PDF" not in body_text.upper()
        check("BİLGİLERİ KAYDET butonu var (1 adet)", has_save)
        check("PDF OLUŞTUR butonu var (1 adet)", has_pdf)
        check("Eski birleşik 'Kaydet ve PDF' etiketi kalktı", combined_gone)

        # 3) Formu doldur + KAYDET'e bas
        pg.locator("div.max-w-4xl input").first.fill("BUTON TEST OLAYI")
        time.sleep(0.3)
        arch_before = len(st("archiveScenes") or [])
        pg.locator("div.max-w-4xl button", has_text="BİLGİLERİ KAYDET").click()
        time.sleep(1.0)

        # Kaydedildi geri bildirimi (buton içi)
        saved_feedback = pg.locator("div.max-w-4xl button", has_text="KAYDEDİLDİ").count() >= 1
        check("Kaydet: 'KAYDEDİLDİ' geri bildirimi", saved_feedback)

        # Modal açık kaldı mı?
        modal_open = pg.locator("div.max-w-4xl").count() == 1
        check("Kaydet: modal açık kaldı", modal_open)

        # Arşive yeni dosya eklendi mi?
        arch_after_save = len(st("archiveScenes") or [])
        check("Kaydet: arşive yeni dosya eklendi", arch_after_save == arch_before + 1,
              f"önce={arch_before} sonra={arch_after_save}")
        new_entry_ok = pg.evaluate(
            "(window.__krokiStore.getState().archiveScenes || []).some(s => s.projectInfo?.eventName === 'BUTON TEST OLAYI')")
        check("Kaydet: yeni dosya girilen bilgiyi taşıyor", new_entry_ok)

        # Şablon başlığı form bilgisiyle tazelendi mi (applyTemplate)?
        tpl_has_info = pg.evaluate(
            "(window.__krokiStore.getState().objects || []).some(o => (o.text || '').includes('BUTON TEST OLAYI'))")
        check("Kaydet: şablon başlığı form bilgisiyle güncel", tpl_has_info)

        # PDF İNDİRİLMEMELİ: eski akışta ~250ms'de download tetiklenirdi; 4 sn bekle
        time.sleep(4)
        check("Kaydet: PDF indirilmedi", len(downloads) == 0,
              f"indirilenler={downloads}")

        # 4) PDF OLUŞTUR'a bas
        arch_before_pdf = len(st("archiveScenes") or [])
        pg.locator("div.max-w-4xl button", has_text="PDF OLUŞTUR").click()

        # Modal kapanmalı
        time.sleep(0.5)
        modal_closed = pg.locator("div.max-w-4xl").count() == 0
        check("PDF: modal kapandı", modal_closed)

        # PDF indirmeli (jsPDF render ~ birkaç sn sürer)
        try:
            with pg.expect_download(timeout=40000) as dl_info:
                pass  # click sonrası event zaten dinleniyor; expect_download sonrakini bekler
            # Not: yukarıdaki blok yeni download'ı bekler; PDF zaten tetiklendi
        except Exception:
            pass
        # Güvenli yol: kısa bekleme + indirme listesi kontrolü
        time.sleep(6)
        pdf_downloaded = any((d or "").lower().endswith(".pdf") for d in downloads)
        check("PDF: rapor indirildi", pdf_downloaded, f"indirilenler={downloads}")

        # Arşiv DEĞİŞMEMELİ (PDF yalnızca PDF üretir)
        arch_after_pdf = len(st("archiveScenes") or [])
        check("PDF: arşive yeni dosya eklenmedi", arch_after_pdf == arch_before_pdf,
              f"önce={arch_before_pdf} sonra={arch_after_pdf}")

        check("JS hatası yok", len(js_errors) == 0, "; ".join(js_errors[:3]))
        pg.screenshot(path="/tmp/buton-ayrimi-test.png")
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
