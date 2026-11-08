#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""El Aletleri kategorisini src/constants/symbols.ts içine ekler (idempotent)."""
import os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, os.path.dirname(__file__))

GEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen_handtools.py')
ns = {'__name__': 'genmod', '__file__': GEN}
with open(GEN, encoding='utf-8') as f:
    exec(compile(f.read(), GEN, 'exec'), ns)

TOOLS = ns['TOOLS']

SYMBOLS_PATH = os.path.join(ROOT, 'src', 'constants', 'symbols.ts')
with open(SYMBOLS_PATH, encoding='utf-8') as f:
    src = f.read()

if "id: 'hand-tools'" in src:
    print('hand-tools kategorisi zaten var — çıkarıp yeniden ekiyor...')
    src = re.sub(r"\n  \{\n    id: 'hand-tools',.*?\n  \},\n", "\n", src, flags=re.S)

lines = []
lines.append("  {")
lines.append("    id: 'hand-tools',")
lines.append("    name: 'El Aletleri',")
lines.append("    symbols: [")
for tid, t in TOOLS.items():
    w, h = t['item']
    asset = f"/assets/symbols/karakalem/handtools/{tid}.svg"
    esc = t['desc'].replace("'", "\\'")
    lines.append(
        f"      {{ id: '{tid}', name: '{t['name']}', src: '{asset}',\n"
        f"        thumbnail: '{asset}', type: 'symbol', width: {w}, height: {h}, group: '{t['group']}', description: '{esc}' }},"
    )
lines.append("    ]")
lines.append("  },")
block = "\n".join(lines)

marker = "  {\n    id: 'arrows',"
if marker not in src:
    raise SystemExit("'arrows' kategorisi işaretçisi bulunamadı!")
src = src.replace(marker, block + "\n" + marker, 1)

with open(SYMBOLS_PATH, 'w', encoding='utf-8') as f:
    f.write(src)

print(f"hand-tools kategorisi eklendi: {len(TOOLS)} sembol")
