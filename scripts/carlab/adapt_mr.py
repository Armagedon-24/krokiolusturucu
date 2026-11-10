#!/usr/bin/env python3
"""new_nr.js (eski chunk için yazılmış tasarım) → yeni chunk'ın Mr bileşenine uyarlar."""
import re

src = open('/home/z/my-project/scripts/carlab/new_nr.js', encoding='utf-8').read()

# --- 1) Önce yerel ad dönüşümleri (imza satırı henüz eski hâlinde) ---
# jsx runtime s → e, Shape Vs → qe
src = src.replace('(0,s.jsx)', '(0,e.jsx)')
src = src.replace('(0,s.jsxs)', '(0,e.jsxs)')
src = src.replace('s.Fragment', 'e.Fragment')
src = src.replace('new Vs', 'new qe')

# uzunluk t → lg, genişlik h → wd (kelime sınırlı; imza satırındaki t=, h= eşleşmez)
src = re.sub(r'\bt(?=[\*\-/])', 'lg', src)
src = re.sub(r'\bt<zs', 'lg<zs', src)
src = re.sub(r'\bh(?=[\-\*/\)\,\+\]])', 'wd', src)

# sınıf parametre adı ps → PSC (yeni chunk'ta ps = MeshPhysicalMaterial)
src = re.sub(r'\bps\b', 'PSC', src)

# ölçek değişkeni e → s (yerel uu ve moto ölçüleri)
src = src.replace('uu=e*H', 'uu=s*H')
src = src.replace('*e*H', '*s*H')
src = re.sub(r'(\d(?:\.\d+)?)\*e([\,\)\]])', r'\1*s\2', src)

# --- 2) İmza ve ilk satır ---
old_sig = 'nr=({x:r,y:o,width:a,height:u,rad:x,type:i,fill:f,zOffset:g,zHeight:c,rollOver:l})=>{'
new_sig = 'Mr=({x:t,y:r,width:o,height:h,rad:x,type:c,fill:f,zOffset:u,zHeight:i,rollOver:l})=>{'
assert old_sig in src
src = src.replace(old_sig, new_sig)

src = src.replace(
    'const d=u>a,t=d?u:a,h=d?a:u,p=d?x-Math.PI/2:x,j=(i||"").toLowerCase();',
    'const d=h>o,lg=d?h:o,wd=d?o:h,p=d?x-Math.PI/2:x,j=(c||"").toLowerCase();')

# zHeight: eski c → yeni i
src = src.replace('ms=c||PSC', 'ms=i||PSC')

# --- 3) dış grup pozisyonu: [r,g||0,o] → [t,u||0,r] ---
src = src.replace('position:[r,g||0,o]', 'position:[t,u||0,r]')

open('/home/z/my-project/scripts/carlab/new_mr.js', 'w', encoding='utf-8').write(src)
print('adapted OK')
print('kalan s.jsx:', src.count('(0,s.jsx'))
print('kalan e*H:', len(re.findall(r'\*e\*H', src)))
print('wd self-ref:', src.count('wd=d?o:wd'))
