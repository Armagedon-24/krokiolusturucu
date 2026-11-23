#!/usr/bin/env python3
"""master-src public/ altindaki TUM PNG'leri KALITESIZ KAYIPSIZ WebP'ye cevirir.

Strateji (kalite oncelikli, projenin optimize-assets.mjs felsefesine uygun):
  - Varsayilan: GERCEK KAYIPSIZ WebP (libwebp lossless, exact=True —
    seffaf piksellerin altindaki RGB degerleri dahil piksel-birebir).
  - Kayipsiz sonuc PNG'den >1.5x buyukse ek aday: q95 yakin-kayipsiz.
    Bu aday YALNIZCA piksel denetimini gecerse secilir:
      * alfa kanali BIT BIT ayni olmali (max fark 0)
      * beyaz zemine birlestirilmis RGB'de mean < 0.8/255 ve p99 < 8/255
        (projenin mevcut esikleri mean<2.0/p99<24'ten COK daha katı)
  - icon-512.png atlanir: iOS apple-touch-icon, og:image tarayicilari ve
    Electron nativeImage yalnizca PNG kabul eder (uygulamayi bozmamak icin).
  - Basarili yazim sonrasi PNG silinir; WebP yeniden acilarak boyut dogrulanir.
"""
import glob
import io
import json
import os
import sys

from PIL import Image, ImageChops

ROOT = "/home/z/my-project/master-src"
KEEP_PNG = {"public/icon-512.png"}  # electron/iOS/og:image PNG zorunluluğu
LOSSLESS_ALLOW_MULT = 1.5  # kayipsiz, PNG'nin bu katindan buyukse q95 adayi denenir
MEAN_MAX = 0.8
P99_MAX = 8


def prepare(im: Image.Image) -> Image.Image:
    if im.mode == "P":
        return im.convert("RGBA")
    if im.mode == "LA":
        return im.convert("RGBA")
    if im.mode == "1":
        return im.convert("RGBA")
    if im.mode == "L":
        return im.convert("RGB")
    return im


def flatten_white(im: Image.Image):
    """Beyaz zemine birlestirilmis RGB + alfa dizileri (denetim icin)."""
    rgba = im.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, rgba).convert("RGB")
    return flat.tobytes(), rgba.getchannel("A").tobytes()


def stats(a: bytes, b: bytes):
    n = len(a)
    hist = [0] * 256
    s = 0
    for i in range(n):
        d = abs(a[i] - b[i])
        s += d
        hist[d] += 1
    acc = 0
    p99 = 255
    lim = n * 0.99
    for d in range(256):
        acc += hist[d]
        if acc >= lim:
            p99 = d
            break
    return s / n, p99


def convert(png_path: str):
    rel = os.path.relpath(png_path, ROOT)
    webp_path = png_path[:-4] + ".webp"
    orig = Image.open(png_path)
    orig.load()
    w, h = orig.size
    im = prepare(orig)
    png_size = os.path.getsize(png_path)

    # Aday 1: gercek kayipsiz (piksel birebir, exact=True)
    bufA = io.BytesIO()
    im.save(bufA, "WEBP", lossless=True, method=6, exact=True)
    candA = bufA.getvalue()

    chosen = candA
    mode = "lossless"
    if len(candA) > LOSSLESS_ALLOW_MULT * png_size:
        # Aday 2: q95 yakin-kayipsiz — katı piksel denetimine tabi
        bufB = io.BytesIO()
        im.save(bufB, "WEBP", quality=95, method=6)
        candB = bufB.getvalue()
        wb = Image.open(io.BytesIO(candB))
        wb.load()
        if wb.size == (w, h):
            flat_o, alpha_o = flatten_white(im)
            flat_w, alpha_w = flatten_white(wb)
            alpha_diff = max(abs(x - y) for x, y in zip(alpha_o, alpha_w)) if len(alpha_o) == len(alpha_w) else 999
            mean, p99 = stats(flat_o, flat_w)
            if alpha_diff == 0 and mean < MEAN_MAX and p99 < P99_MAX and len(candB) < len(candA):
                chosen = candB
                mode = f"q95(mean={mean:.2f},p99={p99},alpha=0)"

    with open(webp_path, "wb") as f:
        f.write(chosen)

    # Dogrulama: dosya aciliyor ve boyutlar ayni
    chk = Image.open(webp_path)
    chk.load()
    if chk.size != (w, h):
        raise RuntimeError(f"BOYUT ESLESMEZ: {png_path} {orig.size} != {chk.size}")
    os.remove(png_path)
    return {
        "file": rel,
        "webp": os.path.relpath(webp_path, ROOT),
        "png": png_size,
        "webp_size": len(chosen),
        "mode": mode,
        "size": f"{w}x{h}",
    }


def main():
    files = sorted(glob.glob(os.path.join(ROOT, "public", "**", "*.png"), recursive=True))
    files = [f for f in files if os.path.relpath(f, ROOT) not in KEEP_PNG]
    rows = []
    skipped = []
    for f in files:
        try:
            rows.append(convert(f))
        except Exception as e:  # noqa: BLE001
            skipped.append({"file": f, "error": str(e)})
            print(f"HATA {f}: {e}", file=sys.stderr)
    os.makedirs("/tmp", exist_ok=True)
    with open("/tmp/webp_report.json", "w") as fh:
        json.dump({"rows": rows, "skipped": skipped}, fh, indent=1)
    tb = sum(r["png"] for r in rows)
    ta = sum(r["webp_size"] for r in rows)
    modes = {}
    for r in rows:
        m = r["mode"].split("(")[0]
        modes[m] = modes.get(m, 0) + 1
    print(f"CEVRILEN : {len(rows)} PNG -> WebP")
    print(f"ATLANDI  : {len(skipped)}")
    print(f"MODLAR   : {modes}")
    print(f"BOYUT    : {tb/1048576:.2f} MB -> {ta/1048576:.2f} MB (-%{100*(tb-ta)/tb:.1f})" if tb else "bos")
    if skipped:
        print("ATLANANLAR:", *[s["file"] for s in skipped], sep="\n  ")


if __name__ == "__main__":
    main()
