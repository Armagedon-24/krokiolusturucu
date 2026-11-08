#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kroki Oluşturucu — 'El Aletleri' kategorisi karakalem SVG üreticisi.
Tüm semboller: şeffaf arka plan + grafit (karakalem) çizgi stili.
Çıktı: public/assets/symbols/karakalem/handtools/*.svg
"""
import os, random

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'symbols', 'karakalem', 'handtools')

def zigzag(x0, y0, x1, y1, n, depth=3.0):
    """(x0,y0)->(x1,y1) arası n dişli testere ağzı."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + (-depth if i % 2 else 0)
        pts.append(f"{x:.1f} {y:.1f}")
    return "M" + " L".join(pts)

def ticks_h(x0, x1, y, step=8, h=4):
    return "".join(f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y+h}"/>' for x in range(x0, x1 + 1, step))

def ticks_v(y0, y1, x, step=8, w=4):
    return "".join(f'<line x1="{x}" y1="{y}" x2="{x+w}" y2="{y}"/>' for y in range(y0, y1 + 1, step))

def diag_hatch(x0, x1, y0, y1, step=7, l=6):
    return "".join(f'<line x1="{x}" y1="{y0}" x2="{x+l}" y2="{y1}"/>' for x in range(x0, x1 + 1, step))

def bristles(x0, x1, ytop, ybot, step=5):
    return "".join(f'<path d="M{x} {ytop} Q{x-1.5} {(ytop+ybot)/2:.1f} {x+1.5} {ybot}"/>' for x in range(x0, x1 + 1, step))

TOOLS = {}

def tool(tid, name, vb, item, group, desc, ghost="", main="", detail="", hatch=""):
    TOOLS[tid] = dict(name=name, vb=vb, item=item, group=group, desc=desc,
                      ghost=ghost, main=main, detail=detail, hatch=hatch)

# ══════════════════════════════ DARBELİ ALETLER ══════════════════════════════

tool('ht-cekic', 'Çekiç (Pençe)', (100, 100), (86, 86), 'Darbeli Aletler',
     'Pençe kollu marangoz çekiçi. Çivi çakma ve sökme aracı.',
     ghost='<path d="M24 18 H82 Q88 18 88 24 Q88 34 82 34 H24 Q18 34 18 28 Q18 18 24 18 Z"/>'
           '<path d="M48 34 Q46 62 48 88 Q48 94 53 94 Q58 94 58 88 Q56 62 57 34"/>',
     main='<path d="M24 18 H82 Q88 18 88 24 Q88 34 82 34 H24 Q18 34 18 28 Q18 18 24 18 Z"/>'
          '<path d="M27 34 Q22 46 13 55"/>'
          '<path d="M39 34 Q34 47 24 58"/>'
          '<path d="M13 55 Q17 61 24 58"/>'
          '<path d="M48 34 Q46 62 48 88 Q48 94 53 94 Q58 94 58 88 Q56 62 57 34"/>',
     detail='<line x1="80" y1="20" x2="80" y2="32"/>'
            '<line x1="27" y1="38" x2="22" y2="49" stroke-width="1"/>'
            '<line x1="35" y1="38" x2="28" y2="52" stroke-width="1"/>',
     hatch='<line x1="49" y1="70" x2="57" y2="70"/>'
           '<line x1="49" y1="77" x2="57" y2="77"/>'
           '<line x1="49" y1="84" x2="57" y2="84"/>')

tool('ht-balyoz', 'Balyoz', (100, 100), (86, 86), 'Darbeli Aletler',
     'İki kalın yüzü olan ağır çekiç. Yıkım ve kırma işlerinde kullanılır.',
     ghost='<path d="M20 14 H80 Q86 14 86 20 V34 Q86 40 80 40 H20 Q14 40 14 34 V20 Q14 14 20 14 Z"/>'
           '<path d="M45 40 Q44 64 46 88 Q46 94 52 94 Q58 94 57 88 Q55 64 55 40"/>',
     main='<path d="M20 14 H80 Q86 14 86 20 V34 Q86 40 80 40 H20 Q14 40 14 34 V20 Q14 14 20 14 Z"/>'
          '<line x1="27" y1="14" x2="27" y2="40"/>'
          '<line x1="73" y1="14" x2="73" y2="40"/>'
          '<path d="M45 40 Q44 64 46 88 Q46 94 52 94 Q58 94 57 88 Q55 64 55 40"/>',
     detail='<line x1="44" y1="40" x2="56" y2="40"/>'
            '<line x1="44" y1="47" x2="56" y2="47"/>',
     hatch='<line x1="46" y1="72" x2="54" y2="72"/>'
           '<line x1="46" y1="79" x2="54" y2="79"/>'
           '<line x1="46" y1="86" x2="54" y2="86"/>')

tool('ht-tokmak', 'Tokmak', (100, 92), (92, 85), 'Darbeli Aletler',
     'Silindir başlı lastik/tahta tokmak. Yüzeyi zorlamadan darbe uygulama aracı.',
     ghost='<path d="M22 16 H78 Q88 16 88 30 Q88 44 78 44 H22 Q12 44 12 30 Q12 16 22 16 Z"/>'
           '<path d="M45 44 Q45 60 46 76 Q46 82 51 82 Q56 82 55 76 Q54 60 55 44"/>',
     main='<path d="M22 16 H78 Q88 16 88 30 Q88 44 78 44 H22 Q12 44 12 30 Q12 16 22 16 Z"/>'
          '<path d="M31 17 Q26 30 31 43"/>'
          '<path d="M69 17 Q74 30 69 43"/>'
          '<path d="M45 44 Q45 60 46 76 Q46 82 51 82 Q56 82 55 76 Q54 60 55 44"/>',
     detail='<line x1="46" y1="64" x2="54" y2="64"/>'
            '<line x1="46" y1="71" x2="54" y2="71"/>')

tool('ht-balta', 'Balta', (110, 110), (92, 92), 'Darbeli Aletler',
     'Kesici başlı balta. Odun kırma, zorlama ve saldırı aleti olabilir.',
     ghost='<path d="M58 28 L20 14 Q6 38 20 62 Q40 56 58 42"/>'
           '<path d="M52 106 Q56 76 60 50"/>',
     main='<path d="M58 28 L20 14 Q6 38 20 62 Q40 56 58 42"/>'
          '<path d="M25 20 Q14 38 26 58" stroke-width="1.1"/>'
          '<path d="M58 28 L78 30 L76 44 L58 42"/>'
          '<path d="M78 30 L90 35 L87 45 L76 44"/>'
          '<path d="M52 106 Q56 76 60 50 L60 34"/>'
          '<path d="M66 106 Q67 78 68 52 L68 36"/>'
          '<line x1="52" y1="106" x2="66" y2="106"/>',
     detail='<line x1="59" y1="48" x2="62" y2="56" stroke-width="1"/>'
            '<line x1="65" y1="47" x2="63" y2="55" stroke-width="1"/>',
     hatch='<line x1="55" y1="62" x2="67" y2="62"/>'
           '<line x1="56" y1="70" x2="67" y2="70"/>')

tool('ht-kazma', 'Kazma', (140, 112), (110, 88), 'Kazı ve Bahçe',
     'İki uçlu kazma. Zemin kazma, beton kırma ve gömü vakalarında kullanılır.',
     ghost='<path d="M58 50 Q84 22 112 44"/><path d="M34 104 L80 46"/>',
     main='<path d="M54 52 Q84 16 116 42"/>'
          '<path d="M59 60 Q86 30 110 51"/>'
          '<path d="M54 52 Q54 57 59 60"/>'
          '<path d="M116 42 Q116 47 110 51"/>'
          '<path d="M34 104 L80 46"/>'
          '<path d="M43 105 L89 48"/>'
          '<line x1="34" y1="104" x2="43" y2="105"/>',
     detail='<line x1="76" y1="55" x2="93" y2="43" stroke-width="1.2"/>'
            '<line x1="70" y1="61" x2="87" y2="49" stroke-width="1.2"/>')

tool('ht-levye', 'Levye', (60, 150), (44, 110), 'Darbeli Aletler',
     'Ucu eğik çelik levye. Kapı/kilit zorlama ve çivi sökme aleti.',
     ghost='<path d="M24 36 Q20 14 32 12 Q44 10 44 22 Q44 28 40 30"/>'
           '<path d="M28 34 L26 128"/><path d="M36 36 L34 130"/>',
     main='<path d="M24 36 Q20 14 32 12 Q44 10 44 22 Q44 28 40 30 L36 30"/>'
          '<path d="M28 34 L26 128"/>'
          '<path d="M36 36 L34 130"/>'
          '<line x1="26" y1="128" x2="34" y2="130"/>'
          '<path d="M26 128 Q18 134 18 140 Q18 144 24 144 L34 142 L34 130"/>',
     detail='<line x1="30" y1="42" x2="30" y2="124" stroke-width="1" opacity="0.7"/>'
            '<line x1="21" y1="139" x2="31" y2="137" stroke-width="1.2"/>')

# ══════════════════════════════ ANAHTARLAR ══════════════════════════════

tool('ht-ingiliz-anahtari', 'İngiliz Anahtarı', (100, 100), (86, 86), 'Anahtarlar',
     'Ayarlanabilir çeneli İngiliz anahtarı. Farklı somunları kavrar.',
     ghost='<path d="M36 34 L36 18 Q36 10 44 10 L60 10 Q68 10 68 18 L68 34"/>'
           '<path d="M42 34 Q38 50 40 68 L42 88 Q43 94 50 94 Q56 94 57 88 L58 68 Q59 50 58 34"/>',
     main='<path d="M36 34 L36 18 Q36 10 44 10 L60 10 Q68 10 68 18 L68 34"/>'
          '<path d="M48 10 L48 20 Q48 24 52 24 Q56 24 56 20 L56 10"/>'
          '<circle cx="52" cy="30" r="4"/>'
          '<path d="M42 34 Q38 50 40 68 L42 88 Q43 94 50 94 Q56 94 57 88 L58 68 Q59 50 58 34"/>',
     detail='<line x1="40" y1="15" x2="44" y2="15" stroke-width="1"/>'
            '<line x1="60" y1="15" x2="64" y2="15" stroke-width="1"/>'
            '<line x1="49" y1="29" x2="55" y2="31" stroke-width="1"/>'
            '<line x1="55" y1="29" x2="49" y2="31" stroke-width="1"/>',
     hatch='<line x1="45" y1="72" x2="54" y2="72"/>'
           '<line x1="45" y1="80" x2="55" y2="80"/>')

tool('ht-yildiz-anahtari', 'Kombinasyon Anahtarı', (160, 60), (118, 44), 'Anahtarlar',
     'Ucu halkalı, ucu açık kombinasyon yıldız anahtarı. Somun ve cıvata çevirir.',
     ghost='<circle cx="26" cy="26" r="15"/>'
           '<path d="M40 16 H118"/><path d="M40 38 H118"/>',
     main='<circle cx="26" cy="26" r="15"/>'
          '<path d="M26 18 L33 22 L33 30 L26 34 L19 30 L19 22 Z"/>'
          '<path d="M40 16 H118 L128 8 Q134 12 132 17 L122 27 Q122 28 132 37 Q134 42 128 46 L118 38 H40"/>'
          '<line x1="40" y1="16" x2="40" y2="38"/>',
     detail='<line x1="46" y1="27" x2="112" y2="27" stroke-width="1" opacity="0.55"/>',
     hatch='')

tool('ht-bijon-anahtari', 'Bijon Anahtarı (Artı)', (110, 110), (92, 92), 'Anahtarlar',
     'Artı biçimli bijon (jant) anahtarı. Otomobil tekerlek somunları için.',
     ghost='<path d="M18 32 L88 68"/><path d="M32 86 L74 16"/>',
     main='<path d="M17 33 L87 69 Q91 71 89 75 L88 77 Q86 81 82 79 L12 43 Q8 41 10 37 L11 35 Q13 31 17 33 Z"/>'
          '<path d="M31 84 L71 14 Q73 10 77 12 L79 13 Q83 15 81 19 L41 89 Q39 93 35 91 L33 90 Q29 88 31 84 Z"/>'
          '<circle cx="13" cy="30" r="6"/><circle cx="91" cy="80" r="6"/>'
          '<circle cx="25" cy="91" r="6"/><circle cx="79" cy="11" r="6"/>',
     detail='<circle cx="13" cy="30" r="2.2"/><circle cx="91" cy="80" r="2.2"/>'
            '<circle cx="25" cy="91" r="2.2"/><circle cx="79" cy="11" r="2.2"/>',
     hatch='')

tool('ht-lokma-anahtari', 'Lokma Anahtarı (Rayç)', (160, 84), (120, 63), 'Anahtarlar',
     'Rayç başlı lokma anahtarı ve somun lokması. Vida-somun sıkma seti.',
     ghost='<circle cx="34" cy="38" r="16"/>'
           '<path d="M64 34 H144 Q150 34 150 40 Q150 46 144 46 H64"/>',
     main='<circle cx="34" cy="38" r="16"/>'
          '<path d="M30 18 L34 14 L38 18"/>'
          '<path d="M50 32 L64 34 L64 44 L50 46"/>'
          '<path d="M64 34 H144 Q150 34 150 40 Q150 46 144 46 L64 44"/>'
          '<path d="M26 56 H44 V74 H26 Z"/>'
          '<line x1="26" y1="56" x2="44" y2="56"/>',
     detail='<line x1="30" y1="58" x2="40" y2="58" stroke-width="1"/>'
            '<line x1="30" y1="72" x2="40" y2="72" stroke-width="1"/>'
            '<circle cx="34" cy="38" r="5" stroke-width="1.2"/>',
     hatch='<line x1="96" y1="34" x2="92" y2="46"/>'
           '<line x1="108" y1="34" x2="104" y2="46"/>'
           '<line x1="120" y1="34" x2="116" y2="46"/>')

tool('ht-allen-anahtari', 'Allen Anahtar Takımı', (130, 92), (102, 72), 'Anahtarlar',
     'Altıgen (Allen) anahtar takımı, L biçimli üç boyut.',
     ghost='<path d="M18 70 H62 Q68 70 68 64 V38"/>',
     main='<path d="M18 70 H60 Q68 70 68 62 V36" stroke-width="5"/>'
          '<path d="M36 80 H78 Q86 80 86 72 V46" stroke-width="4.4"/>'
          '<path d="M54 88 H96 Q104 88 104 80 V56" stroke-width="3.8"/>'
          '<circle cx="18" cy="70" r="3" stroke-width="2"/>'
          '<circle cx="36" cy="80" r="2.6" stroke-width="2"/>'
          '<circle cx="54" cy="88" r="2.2" stroke-width="2"/>'
          '<circle cx="68" cy="34" r="2.6" stroke-width="2"/>'
          '<circle cx="86" cy="44" r="2.3" stroke-width="2"/>'
          '<circle cx="104" cy="54" r="2" stroke-width="2"/>',
     detail='',
     hatch='')

tool('ht-boru-anahtari', 'Boru Anahtarı', (100, 100), (86, 86), 'Anahtarlar',
     'Dişli çeneli boru anahtarı (Stillson). Metal/plastik boruları kavrar.',
     ghost='<path d="M36 36 L30 10 Q28 4 36 4 Q46 4 48 12 L52 32"/>'
           '<path d="M40 48 L36 88"/>',
     main='<path d="M36 36 L30 10 Q28 4 36 4 Q46 4 48 12 L52 32"/>'
          '<path d="M54 36 L60 20 Q62 12 68 14 Q72 17 68 23"/>'
          '<rect x="34" y="32" width="24" height="16" rx="3"/>'
          '<circle cx="46" cy="56" r="5.5"/>'
          '<path d="M38 48 L35 88 Q35 94 45 94 Q53 94 53 87 L53 48"/>',
     detail='<line x1="34" y1="14" x2="41" y2="14" stroke-width="1.2"/>'
            '<line x1="60" y1="19" x2="59" y2="26" stroke-width="1"/>'
            '<line x1="43" y1="56" x2="49" y2="56" stroke-width="1"/>'
            '<line x1="46" y1="53" x2="46" y2="59" stroke-width="1"/>',
     hatch='<line x1="38" y1="66" x2="50" y2="66"/>'
           '<line x1="37" y1="76" x2="51" y2="76"/>')

# ══════════════════════════════ PENSELER ══════════════════════════════

tool('ht-pense', 'Kombine Pense', (100, 100), (86, 86), 'Penseler',
     'Kombine pense. Kesme, kavrama ve bükme işleri için temel el aleti.',
     ghost='<path d="M50 13 Q40 20 38 34 L38 48 L30 88"/>'
           '<path d="M50 13 Q60 20 62 34 L62 48 L70 88"/>',
     main='<path d="M50 13 Q40 20 38 34 L38 48 L30 88 Q29 94 34 95 Q39 95 40 90 L45 60"/>'
          '<path d="M50 13 Q60 20 62 34 L62 48 L70 88 Q71 94 66 95 Q61 95 60 90 L55 60"/>'
          '<path d="M45 60 L46 40"/>'
          '<path d="M55 60 L54 40"/>'
          '<path d="M46 40 Q47 26 50 18"/>'
          '<path d="M54 40 Q53 26 50 18"/>'
          '<circle cx="50" cy="53" r="5"/>',
     detail='<line x1="46" y1="28" x2="49" y2="31" stroke-width="1"/>'
            '<line x1="54" y1="28" x2="51" y2="31" stroke-width="1"/>'
            '<line x1="34" y1="80" x2="39" y2="81" stroke-width="1.2"/>'
            '<line x1="66" y1="80" x2="61" y2="81" stroke-width="1.2"/>',
     hatch='<line x1="34" y1="86" x2="40" y2="87" stroke-width="1"/>'
           '<line x1="66" y1="86" x2="60" y2="87" stroke-width="1"/>')

tool('ht-uclu-pense', 'Uçlu Pense', (100, 112), (80, 90), 'Penseler',
     'Uzun ince uçlu (mürekkep) pense. Dar yerlerde ince iş ve bükme.',
     ghost='<path d="M50 10 Q46 20 45 36 L45 52 L36 98"/>'
           '<path d="M50 10 Q54 20 55 36 L55 52 L64 98"/>',
     main='<path d="M50 10 Q45 20 44 38 L44 54 L36 98 Q35 104 40 105 Q45 105 46 100 L49 62"/>'
          '<path d="M50 10 Q55 20 56 38 L56 54 L64 98 Q65 104 60 105 Q55 105 54 100 L51 62"/>'
          '<circle cx="50" cy="60" r="4.5"/>',
     detail='<line x1="36" y1="90" x2="42" y2="91" stroke-width="1.2"/>'
            '<line x1="64" y1="90" x2="58" y2="91" stroke-width="1.2"/>')

tool('ht-yan-keski', 'Yan Keski', (100, 112), (80, 90), 'Penseler',
     'Yan keski (kargaburun keski). Tel ve ince metal kesme aleti.',
     ghost='<path d="M50 16 L34 34 L36 50 L30 92"/>'
           '<path d="M50 16 L66 34 L64 50 L70 92"/>',
     main='<path d="M50 16 Q42 24 36 36 L34 50 L30 92 Q29 98 34 99 Q39 99 40 94 L44 60"/>'
          '<path d="M50 16 Q58 24 64 36 L66 50 L70 92 Q71 98 66 99 Q61 99 60 94 L56 60"/>'
          '<circle cx="50" cy="60" r="4.5"/>',
     detail='<line x1="42" y1="30" x2="46" y2="34" stroke-width="1"/>'
            '<line x1="58" y1="30" x2="54" y2="34" stroke-width="1"/>')

tool('ht-tel-sokucu', 'Tel Sökücü Pense', (100, 112), (80, 90), 'Penseler',
     'Kademeli çeneli tel sökücü. İzolasyon delgisi ve tel kesme ağzı.',
     ghost='<path d="M50 12 Q45 22 44 38 L44 52 L34 98"/>'
           '<path d="M50 12 Q55 22 56 38 L56 52 L66 98"/>',
     main='<path d="M50 12 Q45 22 44 38 L44 52 L34 98 Q33 104 38 105 Q43 105 44 100 L47 62"/>'
          '<path d="M50 12 Q55 22 56 38 L56 52 L66 98 Q67 104 62 105 Q57 105 56 100 L53 62"/>'
          '<circle cx="50" cy="60" r="4.5"/>',
     detail='<path d="M45 26 L50 30 L55 26" stroke-width="1.2"/>'
            '<path d="M45 34 L50 38 L55 34" stroke-width="1.2"/>'
            '<path d="M45 42 L50 46 L55 42" stroke-width="1.2"/>',
     hatch='<line x1="35" y1="88" x2="42" y2="89" stroke-width="1"/>'
           '<line x1="65" y1="88" x2="58" y2="89" stroke-width="1"/>')

tool('ht-kelepce-pense', 'Kelepçeli Pense (Vise Grip)', (110, 110), (92, 92), 'Penseler',
     'Kilitleyen kelepçeli pense (vise grip). Kavradığı nesneyi kilitler.',
     ghost='<path d="M36 22 Q46 4 64 8 Q74 11 71 20"/>'
           '<path d="M44 58 Q34 67 34 79 Q34 91 46 93"/>',
     main='<path d="M36 22 Q46 4 64 8 Q74 11 71 20 Q68 26 57 26 L46 29"/>'
          '<path d="M38 46 Q48 53 61 48 Q67 46 66 40"/>'
          '<circle cx="48" cy="54" r="5"/>'
          '<path d="M52 57 Q66 62 72 72 L76 84"/>'
          '<path d="M44 58 Q34 67 34 79 Q34 91 46 93 L72 89 Q77 87 75 81"/>'
          '<circle cx="74" cy="94" r="4.5"/>',
     detail='<line x1="44" y1="14" x2="49" y2="18" stroke-width="1"/>'
            '<line x1="54" y1="9" x2="58" y2="14" stroke-width="1"/>'
            '<line x1="64" y1="14" x2="67" y2="19" stroke-width="1"/>'
            '<line x1="70" y1="74" x2="74" y2="78" stroke-width="1"/>',
     hatch='')

# ══════════════════════════════ KESİCİLER ══════════════════════════════

tool('ht-keski', 'Keski', (140, 40), (112, 32), 'Kesiciler',
     'Marangoz keskisi. Ahşap oyma ve düzeltme aleti.',
     ghost='<path d="M10 15 L74 18"/><path d="M10 25 L74 22"/>',
     main='<path d="M10 15 L74 18 L74 22 L10 25 Q7 20 10 15 Z"/>'
          '<path d="M74 14 L82 12 L82 28 L74 26"/>'
          '<path d="M82 12 Q90 8 100 8 L122 8 Q132 8 132 20 Q132 32 122 32 L100 32 Q90 32 82 28"/>'
          '<path d="M126 10 Q132 20 126 30"/>',
     detail='<line x1="16" y1="20" x2="72" y2="20" stroke-width="1" opacity="0.6"/>',
     hatch=diag_hatch(88, 124, 13, 27, step=9, l=6))

tool('ht-ege', 'Eğe', (150, 50), (120, 40), 'Kesiciler',
     'Çelik eğe. Metal, ahşap ve plastik yüzey aşındırma/düzeltme.',
     ghost='<path d="M8 22 H96"/><path d="M8 30 H96"/>',
     main='<path d="M8 22 Q8 20 12 20 L96 18 L96 34 L12 32 Q8 32 8 30 Z"/>'
          '<path d="M96 21 L112 23 L112 29 L96 31"/>'
          '<path d="M112 17 Q116 11 126 10 L134 10 Q146 11 146 26 Q146 41 134 42 L126 42 Q116 41 112 35"/>'
          '<line x1="112" y1="17" x2="112" y2="35"/>',
     detail='<line x1="14" y1="26" x2="92" y2="26" stroke-width="0.8" opacity="0.5"/>',
     hatch=diag_hatch(14, 92, 20, 31, step=5, l=4) + diag_hatch(16, 94, 31, 20, step=5, l=4))

tool('ht-maket-bicagi', 'Maket Bıçağı', (124, 60), (103, 50), 'Kesiciler',
     'Kırılmaz (kademeli) uçlu maket bıçağı. Kesme ve kazıma aleti.',
     ghost='<path d="M30 20 H102"/><path d="M30 40 H102"/>',
     main='<rect x="30" y="20" width="72" height="20" rx="8"/>'
          '<path d="M102 24 L114 27 L112 33 L102 36"/>'
          '<rect x="42" y="23" width="14" height="7" rx="2"/>',
     detail='<line x1="106" y1="26" x2="108" y2="34" stroke-width="1"/>'
            '<line x1="110" y1="27" x2="112" y2="33" stroke-width="1"/>'
            '<line x1="46" y1="25" x2="52" y2="28" stroke-width="1"/>',
     hatch='')

tool('ht-makas', 'Makas', (110, 110), (88, 88), 'Kesiciler',
     'Makas. Kumaş, kağıt ve genel kesme işleri.',
     ghost='<path d="M52 50 L76 12"/><path d="M58 50 L34 12"/>',
     main='<path d="M52 50 L74 12 L84 18 L59 55 Z"/>'
          '<path d="M58 50 L36 12 L26 18 L51 55 Z"/>'
          '<circle cx="55" cy="56" r="3.5"/>'
          '<path d="M52 60 L44 76"/>'
          '<path d="M58 60 L66 76"/>'
          '<ellipse cx="39" cy="87" rx="8.5" ry="10.5"/>'
          '<ellipse cx="71" cy="87" rx="8.5" ry="10.5"/>',
     detail='<line x1="56" y1="30" x2="66" y2="28" stroke-width="1" opacity="0.7"/>'
            '<line x1="54" y1="30" x2="44" y2="28" stroke-width="1" opacity="0.7"/>')

tool('ht-teneke-makasi', 'Teneke Makası', (130, 90), (108, 75), 'Kesiciler',
     'Uzun kulplu teneke makası. Sac ve metal kesme aleti.',
     ghost='<path d="M8 42 Q26 41 44 43"/><path d="M8 48 Q26 49 44 47"/>',
     main='<path d="M8 38 Q24 36 44 39 L44 45 Q24 42 8 43 Z"/>'
          '<path d="M8 52 Q24 54 44 51 L44 45 Q24 49 8 48 Z"/>'
          '<circle cx="58" cy="44" r="4.5"/>'
          '<path d="M55 41 Q80 26 102 22 Q112 20 114 26"/>'
          '<path d="M61 47 Q82 60 102 66 Q112 68 114 62"/>'
          '<path d="M76 34 Q82 44 76 54" stroke-width="1.2"/>'
          '<path d="M83 31 Q90 44 83 57" stroke-width="1.2"/>',
     detail='<line x1="14" y1="40" x2="14" y2="45" stroke-width="1"/>'
            '<line x1="21" y1="40" x2="21" y2="46" stroke-width="1"/>'
            '<line x1="14" y1="51" x2="14" y2="47" stroke-width="1"/>'
            '<line x1="21" y1="52" x2="21" y2="48" stroke-width="1"/>',
     hatch='<line x1="100" y1="24" x2="108" y2="30" stroke-width="1"/>'
           '<line x1="100" y1="64" x2="108" y2="58" stroke-width="1"/>')

tool('ht-bahce-makasi', 'Bahçe Makası', (120, 112), (94, 88), 'Kesiciler',
     'Bypass bahçe makası. Dal ve çalı budama aleti.',
     ghost='<path d="M58 52 Q44 40 34 18"/>',
     main='<path d="M58 52 Q44 40 34 18 Q32 11 38 14 Q54 24 62 45 Q63 51 58 52 Z"/>'
          '<path d="M60 55 Q48 61 37 55 Q33 51 38 47 Q48 42 58 48"/>'
          '<circle cx="59" cy="54" r="4"/>'
          '<path d="M57 58 L45 77"/>'
          '<path d="M63 57 L73 75"/>'
          '<ellipse cx="40" cy="89" rx="8" ry="11"/>'
          '<ellipse cx="78" cy="87" rx="8" ry="11"/>',
     detail='<path d="M38 22 Q48 33 57 44" stroke-width="1" opacity="0.6"/>'
            '<path d="M53 63 Q57 69 53 74" stroke-width="1.1"/>')

tool('ht-zincir-makasi', 'Zincir Makası', (150, 80), (120, 64), 'Kesiciler',
     'Uzun kollu zincir makası. Kilit, zincir ve kablo kesme aleti.',
     ghost='<path d="M8 38 Q26 39 40 42"/><path d="M8 50 Q26 49 40 46"/>',
     main='<path d="M8 32 Q24 34 40 38 L40 44 Q24 41 8 40 Z"/>'
          '<path d="M8 56 Q24 54 40 50 L40 44 Q24 48 8 48 Z"/>'
          '<circle cx="47" cy="44" r="5"/>'
          '<path d="M44 40 Q76 22 110 16 Q122 14 126 20"/>'
          '<path d="M48 37 Q78 26 110 20"/>'
          '<path d="M50 48 Q78 64 110 70 Q122 72 126 66"/>'
          '<path d="M46 45 Q76 66 110 74"/>',
     detail='<line x1="15" y1="34" x2="15" y2="39" stroke-width="1"/>'
            '<line x1="23" y1="36" x2="23" y2="41" stroke-width="1"/>'
            '<line x1="15" y1="54" x2="15" y2="49" stroke-width="1"/>'
            '<line x1="23" y1="52" x2="23" y2="47" stroke-width="1"/>'
            '<circle cx="47" cy="44" r="1.8" stroke-width="1.4"/>',
     hatch='<line x1="108" y1="19" x2="118" y2="26" stroke-width="1"/>'
           '<line x1="104" y1="22" x2="114" y2="29" stroke-width="1"/>'
           '<line x1="108" y1="69" x2="118" y2="62" stroke-width="1"/>'
           '<line x1="104" y1="66" x2="114" y2="59" stroke-width="1"/>')

# ══════════════════════════════ TESTERELER ══════════════════════════════

ZZ_SAW = zigzag(34, 56, 130, 48, 16, depth=3.0)

tool('ht-el-testeresi', 'El Testeresi', (160, 90), (124, 70), 'Testere',
     'Ahşap el testeresi. D-grip kulplu, dişli bıçaklı marangoz testeresi.',
     ghost='<path d="M34 34 L128 30"/>',
     main='<path d="M36 30 Q20 28 12 40 Q6 52 12 62 Q20 74 34 70 L36 62 L34 34 Z"/>'
          '<ellipse cx="23" cy="50" rx="7.5" ry="7"/>'
          '<path d="M36 34 L130 32 Q136 32 136 38 L136 42 Q136 46 130 46 L36 56"/>'
          + f'<path d="{ZZ_SAW}"/>'
          '<circle cx="41" cy="40" r="2.6"/><circle cx="41" cy="50" r="2.6"/>',
     detail='<line x1="48" y1="36" x2="126" y2="35" stroke-width="1" opacity="0.55"/>',
     hatch='')

ZZ_HACK = zigzag(28, 66, 122, 66, 24, depth=2.6)

tool('ht-demir-testeresi', 'Demir Testeresi', (150, 100), (116, 77), 'Testere',
     'C çerçeveli demir testeresi. Metal boru ve profil kesimi.',
     ghost='<path d="M28 24 H122"/>',
     main='<path d="M28 20 Q24 20 24 26 L24 58"/>'
          '<path d="M122 20 Q126 20 126 26 L126 46"/>'
          '<path d="M28 20 H122"/>'
          '<path d="M24 58 L24 62 H30"/>'
          '<path d="M28 62 H122 M28 66 H122"/>'
          + f'<path d="{ZZ_HACK}"/>'
          '<circle cx="126" cy="52" r="4.5"/>'
          '<path d="M126 40 Q140 40 142 50 Q143 60 132 62 L126 62"/>'
          '<ellipse cx="134" cy="52" rx="5" ry="8"/>',
     detail='<line x1="30" y1="64" x2="120" y2="64" stroke-width="0.8" opacity="0.5"/>',
     hatch='')

# ══════════════════════════════ ÖLÇÜ VE KONTROL ══════════════════════════════

tool('ht-serit-metre', 'Şerit Metre', (150, 100), (118, 79), 'Ölçü ve Kontrol',
     'Geri sarımlı şerit metre. Olay yerinde mesafe ölçümü.',
     ghost='<rect x="12" y="30" width="82" height="54" rx="10"/>',
     main='<rect x="12" y="30" width="82" height="54" rx="10"/>'
          '<rect x="58" y="26" width="12" height="8" rx="2"/>'
          '<circle cx="48" cy="57" r="17"/>'
          '<path d="M94 54 H134 M94 62 H134"/>'
          '<path d="M134 50 H144 V64 H136"/>'
          '<path d="M136 64 Q136 70 130 70"/>',
     detail='<path d="M38 46 Q48 40 58 48" stroke-width="1" opacity="0.6"/>'
            '<line x1="100" y1="54" x2="100" y2="62" stroke-width="1"/>'
            '<line x1="110" y1="54" x2="110" y2="62" stroke-width="1"/>'
            '<line x1="120" y1="54" x2="120" y2="62" stroke-width="1"/>'
            '<circle cx="24" cy="76" r="2.2"/>',
     hatch='')

tool('ht-su-terazisi', 'Su Terazisi', (170, 50), (136, 40), 'Ölçü ve Kontrol',
     'Üç gözlü su terazisi. Yatay ve düşey kontrol aracı.',
     ghost='<rect x="8" y="16" width="154" height="18" rx="8"/>',
     main='<rect x="8" y="16" width="154" height="18" rx="8"/>'
          '<rect x="66" y="20" width="38" height="10" rx="3"/>'
          '<ellipse cx="92" cy="25" rx="6" ry="3.5"/>'
          '<rect x="20" y="20" width="24" height="10" rx="3"/>'
          '<rect x="126" y="20" width="24" height="10" rx="3"/>'
          '<line x1="14" y1="16" x2="14" y2="34"/>'
          '<line x1="156" y1="16" x2="156" y2="34"/>',
     detail='<line x1="80" y1="20" x2="80" y2="30" stroke-width="1"/>'
            '<line x1="90" y1="20" x2="90" y2="30" stroke-width="1"/>'
            '<line x1="26" y1="22" x2="38" y2="28" stroke-width="1"/>'
            '<line x1="132" y1="28" x2="144" y2="22" stroke-width="1"/>',
     hatch='')

tool('ht-gonye', 'Gönye', (130, 130), (98, 98), 'Ölçü ve Kontrol',
     'Marangoz gönyesi. Dik açı çizme ve kontrol aracı.',
     ghost='<rect x="24" y="14" width="14" height="102"/>'
           '<rect x="24" y="96" width="88" height="20"/>',
     main='<rect x="24" y="14" width="14" height="102"/>'
          '<rect x="24" y="96" width="88" height="20"/>'
          + ticks_v(20, 92, 36, step=8, w=5) +
          '<circle cx="31" cy="104" r="2.4"/><circle cx="100" cy="106" r="2.4"/>',
     detail='<line x1="27" y1="100" x2="108" y2="112" stroke-width="0.9" opacity="0.5"/>',
     hatch='')

tool('ht-kumpas', 'Kumpas', (160, 70), (128, 56), 'Ölçü ve Kontrol',
     'Verniyeli kumpas. Hassas iç-dış çap ve derinlik ölçümü.',
     ghost='<rect x="10" y="30" width="120" height="12"/>',
     main='<rect x="10" y="30" width="120" height="12"/>'
          '<path d="M10 30 L10 14 L20 14 L20 30"/>'
          '<path d="M44 30 L44 14 L58 14 L58 30"/>'
          '<rect x="44" y="42" width="18" height="14"/>'
          '<circle cx="53" cy="49" r="3"/>'
          '<path d="M10 42 L10 58 L16 58"/>'
          '<path d="M62 50 H142 L142 20"/>'
          '<path d="M44 56 L44 62 H54"/>',
     detail=ticks_h(18, 126, 33, step=8, h=6) +
            '<line x1="58" y1="16" x2="58" y2="30" stroke-width="1" opacity="0.7"/>',
     hatch='')

# ══════════════════════════════ KAZI VE BAHÇE ══════════════════════════════

tool('ht-kurek', 'Kürek', (80, 150), (56, 105), 'Kazı ve Bahçe',
     'Uzun saplı kürek. Toprak kazma ve malzeme taşıma aracı.',
     ghost='<path d="M38 26 L38 88"/><path d="M46 26 L46 88"/>',
     main='<path d="M30 8 Q26 8 26 14 L26 20 Q26 26 32 26 L48 26 Q54 26 54 20 L54 14 Q54 8 50 8 Z"/>'
          '<ellipse cx="40" cy="17" rx="7" ry="5"/>'
          '<path d="M38 26 L38 88 M46 26 L46 88"/>'
          '<rect x="33" y="88" width="18" height="10"/>'
          '<path d="M20 98 Q16 124 26 138 Q33 148 40 148 Q47 148 54 138 Q64 124 60 98 Q50 94 40 94 Q30 94 20 98 Z"/>'
          '<line x1="40" y1="98" x2="40" y2="138"/>',
     detail='<path d="M26 100 Q40 96 54 100" stroke-width="1"/>',
     hatch='<line x1="30" y1="108" x2="34" y2="108" stroke-width="1" opacity="0.5"/>'
           '<line x1="47" y1="108" x2="51" y2="108" stroke-width="1" opacity="0.5"/>')

tool('ht-capa', 'Çapa', (130, 110), (104, 88), 'Kazı ve Bahçe',
     'Bahçe çapası. Toprak sürme, ayıklama ve yatak hazırlama aleti.',
     ghost='<path d="M116 104 L56 38"/>',
     main='<path d="M54 34 L24 24 Q13 27 12 38 L14 48 Q30 58 48 56 L62 44 Q60 38 54 34 Z"/>'
          '<path d="M116 104 L56 38"/>'
          '<path d="M121 99 L61 33"/>'
          '<line x1="116" y1="104" x2="121" y2="99"/>'
          '<path d="M48 56 L54 50 L62 44"/>',
     detail='<line x1="16" y1="45" x2="46" y2="52" stroke-width="1.1"/>'
            '<line x1="54" y1="38" x2="62" y2="30" stroke-width="1.2"/>'
            '<line x1="50" y1="43" x2="58" y2="35" stroke-width="1.2"/>',
     hatch=diag_hatch(22, 44, 30, 48, step=7, l=5))

tool('ht-malaca', 'Malaca (Sıva Malağı)', (150, 60), (120, 48), 'Kazı ve Bahçe',
     'Üçgen sivri uçlu mala. Sıva harcı sürme ve yayma aracı.',
     ghost='<path d="M10 30 Q34 16 62 20"/>',
     main='<path d="M10 30 Q30 14 60 18 Q80 21 90 28 L94 30 L90 32 Q80 39 60 42 Q30 46 10 30 Z"/>'
          '<path d="M94 27 Q100 26 104 28 M94 33 Q100 34 104 32"/>'
          '<path d="M104 30 H110"/>'
          '<path d="M110 24 Q114 18 122 18 L130 18 Q140 18 140 30 Q140 42 130 42 L122 42 Q114 42 110 36"/>',
     detail='<line x1="16" y1="29" x2="86" y2="30" stroke-width="0.9" opacity="0.55"/>'
            '<line x1="116" y1="26" x2="134" y2="26" stroke-width="0.9" opacity="0.5"/>'
            '<line x1="116" y1="34" x2="134" y2="34" stroke-width="0.9" opacity="0.5"/>',
     hatch='')

# ══════════════════════════════ YÜZEY İŞLEMLERİ ══════════════════════════════

tool('ht-tel-firca', 'Tel Fırça', (150, 70), (120, 56), 'Yüzey İşlemleri',
     'Ahşap saplı tel fırça. Pas ve boya sökme, temizlik aleti.',
     ghost='<rect x="10" y="18" width="74" height="34" rx="6"/>',
     main='<rect x="10" y="18" width="74" height="34" rx="6"/>'
          '<circle cx="74" cy="35" r="4"/>'
          '<path d="M84 24 Q102 20 116 26 L120 30 Q122 34 118 38 L110 42 Q96 46 84 44"/>'
          + bristles(16, 78, 52, 63, step=5),
     detail=diag_hatch(16, 66, 22, 48, step=9, l=6) +
            '<line x1="88" y1="30" x2="112" y2="34" stroke-width="1" opacity="0.6"/>',
     hatch='')

tool('ht-zimpara-takozu', 'Zımpara Takozu', (130, 90), (104, 72), 'Yüzey İşlemleri',
     'Zımpara sarılı takoz. Yüzey hafifletme ve boya öncesi hazırlık.',
     ghost='<rect x="16" y="26" width="86" height="36" rx="6"/>',
     main='<rect x="16" y="26" width="86" height="36" rx="6"/>'
          '<path d="M16 62 L16 68 Q16 74 24 74 L94 74 Q102 74 102 66 L102 62"/>'
          '<path d="M102 62 L112 68 L102 74"/>'
          '<path d="M30 40 Q48 36 66 40 Q80 43 92 40"/>',
     detail='<line x1="24" y1="52" x2="30" y2="52" stroke-width="1"/>'
            '<line x1="38" y1="52" x2="44" y2="52" stroke-width="1"/>'
            '<line x1="52" y1="52" x2="58" y2="52" stroke-width="1"/>'
            '<line x1="66" y1="52" x2="72" y2="52" stroke-width="1"/>'
            '<line x1="80" y1="52" x2="86" y2="52" stroke-width="1"/>',
     hatch='')

tool('ht-macun-bicagi', 'Macun Bıçağı (Spatula)', (140, 60), (114, 49), 'Yüzey İşlemleri',
     'Esnek uçlu macun bıçağı. Macun sürme, sıyırma ve düzeltme.',
     ghost='<path d="M10 22 Q40 16 76 20"/>',
     main='<path d="M10 22 Q40 16 76 20 L76 40 Q40 44 10 38 Q6 30 10 22 Z"/>'
          '<path d="M76 26 L88 29 M76 34 L88 31"/>'
          '<rect x="88" y="20" width="42" height="22" rx="8"/>'
          '<circle cx="121" cy="31" r="3.5"/>',
     detail='<path d="M18 25 Q40 21 70 23" stroke-width="1" opacity="0.6"/>',
     hatch='')

tool('ht-silikon-tabanca', 'Silikon Tabancası', (170, 74), (134, 58), 'Yüzey İşlemleri',
     'Şeffaf iskeletli silikon tabancası. Yalıtım ve dolgu mastiği uygulama.',
     ghost='<path d="M8 26 H86"/><path d="M8 40 H86"/>',
     main='<path d="M8 26 H86 V40 H8 L1 33 Z"/>'
          '<line x1="88" y1="18" x2="88" y2="48"/>'
          '<path d="M88 20 Q100 20 100 32 Q100 44 88 44"/>'
          '<path d="M100 32 H150"/>'
          '<path d="M96 44 L106 60 Q110 65 116 62 Q121 59 118 53 L108 41"/>'
          '<path d="M100 44 Q108 46 106 53"/>',
     detail='<path d="M20 30 H74" stroke-width="0.9" opacity="0.5"/>'
            '<line x1="136" y1="29" x2="136" y2="35" stroke-width="1"/>'
            '<line x1="142" y1="29" x2="142" y2="35" stroke-width="1"/>'
            '<line x1="148" y1="29" x2="148" y2="35" stroke-width="1"/>',
     hatch='<line x1="103" y1="52" x2="110" y2="57" stroke-width="1"/>'
           '<line x1="109" y1="49" x2="116" y2="54" stroke-width="1"/>')

tool('ht-zimba-tabanca', 'Zımba Tabancası', (150, 80), (120, 64), 'Yüzey İşlemleri',
     'Mekanik zımba tabancası. Kablo tutturma ve döşeme işleri.',
     ghost='<path d="M18 30 H98"/>',
     main='<rect x="18" y="30" width="80" height="24" rx="8"/>'
          '<path d="M6 36 L18 33 L18 51 L6 48 Z"/>'
          '<path d="M98 36 L118 40 Q130 44 128 54 Q126 62 116 62 L100 56 Q96 52 96 46 L96 36"/>'
          '<path d="M26 54 Q26 62 34 62 Q40 62 40 56"/>',
     detail='<line x1="8" y1="41" x2="8" y2="45" stroke-width="1.2"/>'
            '<line x1="12" y1="41" x2="12" y2="45" stroke-width="1.2"/>'
            '<line x1="24" y1="36" x2="24" y2="48" stroke-width="0.9" opacity="0.5"/>',
     hatch='<line x1="104" y1="44" x2="116" y2="48" stroke-width="1"/>'
           '<line x1="103" y1="50" x2="115" y2="54" stroke-width="1"/>')

tool('ht-el-matkabi', 'El Matkabı', (110, 140), (80, 102), 'Yüzey İşlemleri',
     'Kol matkabı (el matkabı). Elektriksiz, dişli çarklı delme aleti.',
     ghost='<path d="M52 30 L52 108"/><path d="M60 30 L60 108"/>',
     main='<circle cx="56" cy="22" r="8"/>'
          '<path d="M52 30 L52 108 M60 30 L60 108"/>'
          '<rect x="42" y="108" width="28" height="8"/>'
          '<path d="M52 30 L48 18 L64 18 L60 30"/>'
          '<path d="M56 18 V8"/>'
          '<circle cx="40" cy="94" r="15"/>'
          '<path d="M40 94 L28 82"/>'
          '<circle cx="28" cy="82" r="3.5"/>',
     detail='<line x1="50" y1="22" x2="62" y2="22" stroke-width="1.1"/>'
            '<line x1="50" y1="26" x2="62" y2="26" stroke-width="1.1"/>'
            '<path d="M33 88 Q40 82 47 88" stroke-width="1" opacity="0.6"/>',
     hatch='')

print(f"{len(TOOLS)} alet tanımlandı")

# ── SVG yazma ────────────────────────────────────────────────────────────────

SVG_TMPL = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
    '<defs><filter id="kk" x="-12%" y="-12%" width="124%" height="124%">\n'
    '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="{s1}" result="wob"/>\n'
    '<feDisplacementMap in="SourceGraphic" in2="wob" scale="2.2" result="d1"/>\n'
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="{s2}" result="grain"/>\n'
    '<feDisplacementMap in="d1" in2="grain" scale="1.1"/>\n'
    '</filter></defs>\n'
    '<g filter="url(#kk)" fill="none" stroke="#2b2723" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">\n'
    '<g stroke-width="4.6" opacity="0.13" transform="translate(1.2 1)">{ghost}</g>\n'
    '{main}\n'
    '<g stroke="#3e3831" stroke-width="1.4" opacity="0.8">{detail}</g>\n'
    '<g stroke="#4c453c" stroke-width="1.05" opacity="0.55">{hatch}</g>\n'
    '</g>\n'
    '</svg>\n'
)

os.makedirs(OUT, exist_ok=True)
rng = random.Random(24)
for tid, t in TOOLS.items():
    w, h = t['vb']
    svg = SVG_TMPL.format(w=w, h=h, s1=rng.randint(1, 999), s2=rng.randint(1, 999),
                          ghost=t['ghost'], main=t['main'], detail=t['detail'], hatch=t['hatch'])
    with open(os.path.join(OUT, f"{tid}.svg"), 'w', encoding='utf-8') as f:
        f.write(svg)
print("SVG dosyaları yazıldı →", os.path.abspath(OUT))
