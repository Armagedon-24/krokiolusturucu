#!/usr/bin/env python3
"""assetMigration.ts içindeki LEGACY_PNG_TO_WEBP setini diskin GERÇEK
webp envanteriyle yeniden üretir (eski kayıtlı projelerin .png yolları bu
küme üzerinden .webp'ye taşınır; küme diskte olmayan dosya içeremez)."""
import glob
import os
import re

ROOT = "/home/z/my-project/master-src"
F = os.path.join(ROOT, "src", "utils", "assetMigration.ts")

webps = sorted(
    "/" + os.path.relpath(p, os.path.join(ROOT, "public")).replace(os.sep, "/")
    for p in glob.glob(os.path.join(ROOT, "public", "**", "*.webp"), recursive=True)
)
body = "\n".join(f"  '{w}'," for w in webps)

src = open(F, encoding="utf-8").read()
new_set = "export const LEGACY_PNG_TO_WEBP: ReadonlySet<string> = new Set([\n" + body + "\n]);"
src2, n = re.subn(
    r"export const LEGACY_PNG_TO_WEBP: ReadonlySet<string> = new Set\(\[.*?\]\);",
    new_set.replace("\\", "\\\\"),
    src,
    count=1,
    flags=re.S,
)
assert n == 1, "set blogu bulunamadi"
open(F, "w", encoding="utf-8").write(src2)
print(f"Set yenilendi: {len(webps)} girdi")
