# Araç Sistemi V2 — Kurulum Rehberi

"3D Olay Yeri Modeli" içindeki **tüm araç sınıfları** baştan yazıldı. Artık her
araç türü 3D'de ayrı ve net tanınıyor: binek otomobil, SUV, taksi, **polis**,
jandarma, kamyon, **itfaiye**, **ambulans**, otobüs, kamyonet, tır, iş makineleri
ve daha fazlası.

Görseller için `gorseller/` klasörüne bakın:

- `once_canli_surum_ekran.png` — Sizin ekran görüntünüz (eski sistem): itfaiye
  aracı koca bir kırmızı kutu, karanlık araçlar forklift gibi duruyordu.
- `v2_tum_siniflar_kusbakisi.png` — Yeni sistemin 30 araç sınıfının kuşbakışı
  karşılaştırması (hepsi tek görselde, etiketli).
- `v2_polis_*.png`, `v2_itfaiye_*.png`, `v2_ambulans_*.png`, `v2_kamyon_*.png`,
  `v2_taksi_*.png`, `v2_sedan_*.png` — Görev araçlarının kuşbakışı ve önden
  görünümleri.

## Yeni sistemde ne var?

| Sınıf | Tanınma özellikleri |
| --- | --- |
| Binek otomobil (sedan) | Tek parça gövde silüeti, cam kabin, tavan, jantlı tekerler, far/stop/tampon/ayna/kapı kolu |
| Polis Aracı | Beyaz gövde + mavi kaput/bagaj paneli + yan mavi bant + tavan kırmızı-mavi lightbar + öne itme bariyeri |
| Jandarma | SUV tabanı + mavi bant + lightbar + bariyer |
| Taksi | Sarı gövde + tavan tabelası (amber ışıklı) |
| İtfaiye | Kırmızı kabin + ekipman gövdesi + yan gümüş rulo kapılar + **tavan merdiveni** + hortum yuvası + flaşörler |
| Ambulans | Beyaz kutu gövde + turuncu şerit + **tavan kırmızı haç** + lightbar + turuncu beacon |
| Kamyon | Kaput üstü kabin (deflektörlü) + kapalı kasa + panel çizgileri + 6 teker + yan etek |
| Damperli / Çekici / Vinç / Mikser | Açık kasa / rampa + kurtarma kolu / bom / döner tambur |
| Tır & Dorse | Çekici kabin + ayrı gri dorse (aralarında boşluk) |
| Otobüs / Minibüs / Tramvay | Cam bandı, ön cam, gidiş tabelası, tavan klimaları, kapı çizgileri |
| Kamyonet (Pickup) | Kabin + **açık kasa** (kuşbakışından kasa içi görünür) |
| Panelvan / Karavan / Belediye | Tek hacim gövde; belediyede turuncu renk + beacon |
| İş makineleri | Traktör (büyük arka teker), forklift (direk + çatal), ekskavatör (palet + bom + kova), dozer, ATV, golf aracı |
| TOMA / Zırhlı | Mavi gövde + su topu / kule + mazgallar |
| Motosiklet | İki teker, direksiyon, sele, çamurluk, far |

Renk kuralı: polis/jandarma/ambulans/itfaiye/taksi/belediye/TOMA/zırhlı sınıfları
**görev renkleriyle** çizilir (2D'de hangi renge boyarsanız boyayın — kimlik
her zaman korunur). Diğer araçlarda 2D'den gelen renginiz kullanılır; yalnızca
2D sembolünden gelen koyu gri dolgu (#33383f) yerine sınıfın kendi rengi
kullanılır, koyu ama renkli tonlar (ör. koyu kırmızı) korunur.

## Hangi kurulum size uygun?

### A) Hazır dosya ile hızlı çözüm (önerilen)

`ThreeDPreview-CrJ9NuIZ.js` dosyasını projenizin derlenmiş çıktısında aynı
isimli dosyanın üzerine kopyalayın ve deploy edin:

```
ThreeDPreview-CrJ9NuIZ.js  →  <proje>/dist/assets/ThreeDPreview-CrJ9NuIZ.js
```

2D paletta değişiklik gerekmez: polis, ambulans, itfaiye, taksi, jandarma,
kamyonet, tır… araçları **zaten paletinizde mevcut**; yerleştirdiğiniz anda
yeni 3D karşılıkları görünür. Tarayıcı önbelleğini aşmak için sayfayı
Ctrl+Shift+R ile açın.

> DİKKAT: Kaynaktan `npm run build` alırsanız yama kaybolur (chunk adı da
> değişebilir). Kalıcı çözüm için B şıkkını uygulayın.

### B) Kaynaktan derliyorsanız — kalıcı çözüm

1. `arac-modeli-kaynak/` klasöründeki `Arac3DV2.js` ve `Arac3DModel.jsx`
   dosyalarını projenize ekleyin (ör. `src/components/three/`).

2. ThreeDPreview kaynağında aracı çizen bileşeni bulun (yayındaki derlemede
   adı `Mr`, sarmalayıcısı `ur`). Sarmalayıcıyı (fill çıkarma + devrilme
   tespiti) koruyun, `Mr` yerine şunu koyun:

   ```jsx
   import Arac3D from './Arac3DModel.jsx';
   // ... araç dalında:
   if (v) return <Arac3D {...obj} />;
   ```

3. Prop arayüzü birebir aynıdır:
   `x, y, width, height, rad, type, fill, zOffset, zHeight, rollOver`.

4. `Arac3DModel.jsx` içindeki `SCALE` (0.55) uygulamanızdaki cm→sahne
   ölçeğiyle aynı olmalıdır.

## Teknik notlar

- Model sistemi tek bir fabrika fonksiyonudur: `makeArac3DV2({ e, O, s, qe, rs })`
  (e = jsx runtime, O = React, s = ölçek, qe = THREE.Shape, rs =
  THREE.ExtrudeGeometry). Yayındaki chunk'a da bu fabrika `makeArac3DV2` adıyla
  gömüldü ve araç bileşeni `Mr=makeArac3DV2({e,O,s,qe,rs})` oldu; başka hiçbir
  satıra dokunulmadı.
- Tip çözümleme önce sembol **id**'sine bakar (`v-police`, `v-firetruck`,
  `v-trailer`…), id listede yoksa ad metninden sınıf tahmin eder. Böylece
  "v-truck Kamyon (itfaiye)" etiketi yanlışlıkla itfaiye aracı çizmez.
- Devrilme (rollOver), zHeight ile yükseklik ölçekleme, çok küçük çizimlerin
  otomatik büyütülmesi (min ~100 birim) aynen korundu.
- Yeni model, uygulamanın gerçek modül grafiğiyle (vendor-react + vendor-three +
  PMREM ortam haritası, hemisphere/ambient/directional ışıklar, #bcd4e8 arka
  plan) gerçek tarayıcıda test edildi; `gorseller/v2_*.png` ekran görüntüleri
  bu testten alındı. Yamalı chunk `node --check` ile ve tarayıcıda modül
  importu ile doğrulandı.
