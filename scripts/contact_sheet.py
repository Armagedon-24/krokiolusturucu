#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Üretilen el aleti SVG'lerini kontakt föyü (PNG) halinde rasterize eder."""
import cairosvg, glob, os, io
from PIL import Image, ImageDraw

SRCDIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'symbols', 'karakalem', 'handtools')
OUT = '/tmp/handtools_sheet.png'
COLS, CELL, LABEL = 7, 170, 18

files = sorted(glob.glob(os.path.join(SRCDIR, '*.svg')))
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * CELL, rows * (CELL + LABEL)), (250, 248, 244))
draw = ImageDraw.Draw(sheet)
alpha_report = []

for i, f in enumerate(files):
    png = cairosvg.svg2png(url=f, output_width=CELL - 30, output_height=CELL - 30, background_color='rgba(0,0,0,0)')
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    a = im.getchannel('A')
    nonzero = sum(1 for p in a.getdata() if p > 10)
    alpha_report.append((os.path.basename(f), nonzero))
    cell = Image.new('RGBA', (CELL - 30, CELL - 30), (250, 248, 244, 255))
    cell.alpha_composite(im)
    cx, cy = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL)
    sheet.paste(cell.convert('RGB'), (cx + 15, cy + 12))
    draw.text((cx + 8, cy + CELL - 4), os.path.basename(f).replace('ht-', '').replace('.svg', ''), fill=(40, 40, 40))

sheet.save(OUT)
print('föy →', OUT)
empty = [n for n, nz in alpha_report if nz < 50]
print('boş görünen:', empty if empty else 'yok')
for n, nz in alpha_report[:5]:
    print(' ', n, 'opak piksel:', nz)
