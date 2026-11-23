# -*- coding: utf-8 -*-
"""CaseManagerModal footer bloğunu satır bazlı değiştirir.
Eşleşme yalnızca ASCII çapalarla yapılır (Türkçe İ/ı kod varyantları eşleşmeyi bozmasın).
"""
import io

PATH = '/home/z/my-project/master-src/src/components/UI/CaseManagerModal.tsx'

with io.open(PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()  # satır sonları korunur

# 1) onClick={handleSaveAndClose} satırını bul (ASCII çapa)
anchor_idx = None
for i, ln in enumerate(lines):
    if 'onClick={handleSaveAndClose}' in ln:
        anchor_idx = i
        break
if anchor_idx is None:
    raise SystemExit('HATA: handleSaveAndClose bulunamadi')

# 2) Blok sınırlarını bul: geriye footer div'i, ileriye ilk </div>
start = None
for j in range(anchor_idx, -1, -1):
    if 'bg-white/5 p-4 flex justify-end' in lines[j]:
        start = j
        break
if start is None:
    raise SystemExit('HATA: footer div acilis satiri bulunamadi')

end = None
for j in range(anchor_idx, len(lines)):
    if lines[j].strip() == '</div>':
        end = j
        break
if end is None:
    raise SystemExit('HATA: footer </div> bulunamadi')

NEW_FOOTER = u'''        <div className="bg-white/5 p-4 flex flex-wrap justify-end gap-3 flex-shrink-0 border-t border-white/5">
           <p className="text-[9px] text-gray-600 font-bold uppercase mr-auto flex items-center gap-2 italic">
              <Info size={12} />
              Kaydet yaln\u0131zca kaydeder; PDF \u00e7\u0131kt\u0131s\u0131 \u0130\u00e7\u0130n "PDF Olu\u015ftur" tu\u015funu kullan\u0131n
           </p>
           <button
             onClick={handleNewDrawing}
             className="px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-black text-xs uppercase tracking-[0.1em] rounded-xl transition-all border border-red-500/20"
           >
             YEN\u0130 \u00c7\u0130Z\u0130M
           </button>
           <button
             onClick={handleSave}
             title="\u00c7izimi ve bilgileri Olay Y\u00f6netimi dosyalar\u0131na kaydeder (PDF \u00fcretmez)"
             className={`px-6 py-3 font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all border flex items-center gap-2 ${justSaved ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
           >
             {justSaved ? <Check size={14} /> : <Save size={14} />}
             {justSaved ? 'KAYDED\u0130LD\u0130' : 'B\u0130LG\u0130LER\u0130 KAYDET'}
           </button>
           <button
             onClick={handleGeneratePdf}
             title="Raporu PDF olarak indirir ve yeni sekmede a\u00e7ar"
             className="px-8 py-3 bg-[#F5C518] hover:bg-[#E2B616] text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-[#F5C518]/20 flex items-center gap-2"
           >
             <FileDown size={14} />
             PDF OLU\u015eTUR
           </button>
        </div>
'''

new_lines = lines[:start] + [ln + '\n' for ln in NEW_FOOTER.split('\n')[:-1]] + lines[end + 1:]

with io.open(PATH, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# 3) Dogrulama
with io.open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()
assert 'handleSaveAndClose' not in content, 'HATA: eski handler hala duruyor'
assert 'handleSave' in content and 'handleGeneratePdf' in content, 'HATA: yeni handlerlar yok'
assert 'PDF OLU\u015eTUR' in content, 'HATA: PDF etiketi yok'
print('OK: footer degistirildi, eski handler kalmadi')
print('satir sayisi:', content.count('\n'))
