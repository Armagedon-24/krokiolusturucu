#!/usr/bin/env python3
"""ThreeDPreview chunk'ındaki eski araç bileşenini (nr) yeni tasarımla değiştirir."""
import sys

SRC = '/tmp/threed.js'
NEW = '/home/z/my-project/scripts/carlab/new_nr.js'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/threed_patched.js'

src = open(SRC, encoding='utf-8').read()
new_nr = open(NEW, encoding='utf-8').read().strip()

i_start = src.find('nr=({x:r,y:o,width:a,height:u,rad:x,type:i,fill:f,zOffset:g,zHeight:c,rollOver:l})=>{')
i_end = src.find(',Me={airliner')
assert i_start != -1 and i_end != -1, 'span not found'
assert i_start < i_end

# Doğrulama: değiştirilen aralıkta nr tanımı dışında kod yok
old_seg = src[i_start:i_end]
assert old_seg.count('Me={airliner') == 0

patched = src[:i_start] + new_nr + src[i_end:]
open(OUT, 'w', encoding='utf-8').write(patched)
print('patched ->', OUT, f'({len(patched)} bytes, replaced {i_end-i_start} with {len(new_nr)})')
