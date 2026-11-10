# Yeni 3D Araç Modeli — Kurulum Rehberi

"3D Olay Yeri Modeli" içindeki araç görseli tamamen yeniden tasarlandı.
Görseller için `gorseller/` klasörüne bakın:

- `once_*.png` — Eski model (ekran görüntünüzdeki araç): kabin eğik kutulardan
  oluştuğu için ön cam "rampa" gibi taşıyor, tekerlekler küçük ve gömük, düz
  siyah leke gibi görünüyor.
- `mevcut_canli_surum_kusbakisi.png` — Sitede şu an yayında olan (yeni
  yüklenen) sürümün aracı: öncekinden iyi ama cam tavan öne kaymış "tekne"
  gibi duruyor, oranlar bozuk.
- `sonra_*.png` — Bu paketteki yeni tasarım: tek parça gövde silüeti, doğru
  oranlı cam kabin + tavan, büyük jantlı tekerler, far/stop/tampon/ayna
  detayları. Sedan, SUV, otobüs ve kamyon (itfaiye) sınıflarının hepsi
  yeniden modellendi; motosiklet eski hâliyle korundu.

## Hangi kurulum size uygun?

### A) Hazır dosya ile hızlı çözüm (önerilen ilk adım)

`ThreeDPreview-CrJ9NuIZ.js` dosyasını projenizin derlenmiş çıktısındaki aynı
isimli dosyanın üzerine kopyalayın ve deploy edin:

```
ThreeDPreview-CrJ9NuIZ.js  →  <proje>/dist/assets/ThreeDPreview-CrJ9NuIZ.js
```

Bu, **şu an yayında olan** derlemeye birebir uyan yamalı chunk'tır (aracı çizen
`Mr` bileşeni yenisiyle değiştirildi; başka hiçbir kod satırına dokunulmadı).
Tarayıcı önbelleğini aşmak için sayfayı Ctrl+Shift+R ile açın.

> DİKKAT: Kaynaktan `npm run build` alırsanız Vite chunk'ı yeniden üretir ve
> dosya adı değişir; yama kaybolur. Kalıcı çözüm için B şıkkını uygulayın.

### B) Kaynak koddan derliyorsanız — kalıcı çözüm

1. `arac-modeli-kaynak/Arac3DModel.jsx` dosyasını projenize ekleyin
   (ör. `src/components/three/Arac3DModel.jsx`).

2. ThreeDPreview kaynağında aracı çizen bileşeni bulun. Yayındaki sürümde
   bileşenin adı `Mr`, sarmalayıcısı (fill rengi çıkarma + "devrilmiş araç"
   tespiti yapan) `ur`. Sarmalayıcıyı koruyup `Mr`'in yerine `Arac3D`
   bileşenini koyun.

3. Prop arayüzü birebir aynıdır:
   `x, y, width, height, rad, type, fill, zOffset, zHeight, rollOver`.

4. `SCALE` sabiti (0.55) cm→sahne birimi çarpanıdır; uygulamanızda farklıysa
   kendi değerinizi yazın.

## Neler değişti? (özet)

| Konu | Eski (ekran görüntünüz) | Yeni tasarım |
| --- | --- | --- |
| Kabin | Eğik kutular; ön cam "rampa" gibi taşar | Tek parça cam kabin extrude + gövde renginde tavan plakası |
| Gövde | Kutu + taşan plakalar | Kaput/bagaj/bel hattı dahil tek extrude, yumuşak silüet |
| Oranlar | Çok alçak bel hattı → dev cam üçgeni | Gerçek otomobil oranları (bel hattı ~100 cm, tavan ~145 cm) |
| Tekerlek | r≈20 cm, gövdeye gömük | sedan 28 / SUV 30 / otobüs 42 / kamyon 36 cm, jant + 5 kol |
| Detaylar | Yeşil şeritler, tutarsız plakalar | Far (hafif ışıklı), stop, ızgara, tampon, ayna, plaka, kapı çizgisi |
| Otobüs | Düşük kutu | 3 m tek gövde, cam bandı, ön cam, büyük tekerler |
| Kamyon/İtfaiye | Garip kabin | Kasa + kabin + şasi, 6 teker, tepe lambası |
| Devrilme (rollOver) | Var | Korundu |
| zHeight ile yükseklik | Var | Korundu (sınıf bazlı varsayılanlarla) |
| Renk kuralları (taksi/itfaiye/polis) | Var | Korundu |
| Tıklayınca açılan kapılar | Var (kayıt altına alınmayan yerel durum) | Kaldırıldı — görsel karmaşanın ana kaynağıydı; istenirse ayrıca eklenebilir |

## Doğrulama

Yeni model, uygulamayla aynı ışıklandırmayla (hemisphere + ambient +
directional, arka plan #bcd4e8) gerçek react-three-fiber ortamında test edildi;
`gorseller/sonra_*.png` ekran görüntüleri bu testten alındı. Yamalı chunk
`node --check` ile sözdizimi açısından da doğrulandı.

## Bilinen notlar

- Sitede gece içinde yeni bir derleme yayınlanmış (chunk adı
  `ThreeDPreview-D91A2znq.js` → `ThreeDPreview-CrJ9NuIZ.js` olmuş). Ekran
  görüntünüzdeki araç eski derlemeye ait. Eski derlemeye ihtiyaç olursa
  haber verin, ona uygun yama da üretilebilir.
- 2D sembolün dolgu rengi koyuysa uygulama rengi `#2a2e33`'e yükseltiyor;
  yeni modelde koyu renk de net okunuyor (camlar daha koyu ve parlak,
  tavan/şeritler ayrık).
- Çok küçük çizilen araçlar otomatik büyütülmeye devam eder (min ~100 cm).
