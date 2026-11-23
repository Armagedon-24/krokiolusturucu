#!/usr/bin/env python3
"""WebP gecisi sonrasi kod referanslarini (.png -> .webp) güvenli sekilde gunceller.

Kurallar:
  - Yalnizca GERCEKten WebP'ye cevrilmis dosya yollarinin string literalleri
    degistirilir: '/assets/...png' ve ${BASE_URL}assets/...png bicimleri.
  - '/logo.png' -> '/logo.webp' (favicon, Topbar, AboutModal, AdminLoginModal, templates).
  - HICBIR ZAMAN degistirilmez: image/png MIME, dosya-sucu filtreleri ('.png' accept),
    openstreetmap karolama URL'i, leaflet node_modules importlari, disa aktarma
    dosya adlari, '/icon-512.png' (PNG olarak kalan dosya), og:image (kalir).
"""
import glob
import json
import os
import re
import sys

ROOT = "/home/z/my-project/master-src"
KEEP = {"/icon-512.png"}  # PNG kalan dosya


def converted_assets():
    out = set()
    base = os.path.join(ROOT, "public")
    for p in glob.glob(os.path.join(base, "**", "*.webp"), recursive=True):
        out.add("/" + os.path.relpath(p, base).replace(os.sep, "/"))
    return out


ASSET_RE = re.compile(r"(?P<full>(?P<lead>['\"`])(?P<slash>/?)assets/[A-Za-z0-9_\-./]+\.png(?P=lead))")
LOGO_RE = re.compile(r"(?P<lead>['\"`])/(?P<name>logo|favicon)\.png(?P=lead)")


def replace_in_text(text, webps):
    changes = []

    def sub_asset(m):
        lead = m.group("lead")
        yol = full = m.group("full")[1:-1]  # tirnaklari at
        norm = yol if yol.startswith("/") else "/" + yol
        cand = norm[:-4] + ".webp"
        if cand in webps:
            new = yol[:-4] + ".webp"
            changes.append(f"{norm} -> {new}")
            return lead + new + lead
        return full

    def sub_logo(m):
        lead = m.group("lead")
        name = m.group("name")
        changes.append(f"/{name}.png -> /{name}.webp")
        return f"{lead}/{name}.webp{lead}"

    text = ASSET_RE.sub(sub_asset, text)
    text = LOGO_RE.sub(sub_logo, text)
    return text, changes


def main():
    webps = converted_assets()
    targets = []
    for pat in ("src/**/*.ts", "src/**/*.tsx", "src/**/*.css", "index.html",
                "electron/*.cjs", "electron/*.js", "api/*.ts", "public/*.js"):
        targets += glob.glob(os.path.join(ROOT, pat), recursive=True)
    all_changes = {}
    for f in sorted(set(targets)):
        rel = os.path.relpath(f, ROOT)
        if rel.startswith("src/store/useStore") and rel.endswith("useStore.ts"):
            pass  # normal isleme girer; yorumlar degismesin diye asagida yorum korumasi yok — yol literalleri zaten yok
        try:
            text = open(f, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        new, ch = replace_in_text(text, webps)
        if ch:
            open(f, "w", encoding="utf-8").write(new)
            all_changes[rel] = ch
    for f, ch in all_changes.items():
        print(f"{f}: {len(ch)} degisiklik")
        for c in ch[:6]:
            print("   ", c)
        if len(ch) > 6:
            print(f"    ... +{len(ch)-6} daha")
    total = sum(len(c) for c in all_changes.values())
    print(f"\nTOPLAM: {total} referans guncellendi, {len(all_changes)} dosya")
    json.dump(all_changes, open("/tmp/webp_ref_changes.json", "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
