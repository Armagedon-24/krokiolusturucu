# Kapı Sistemi Yaması — Kurulum Talimatları

> **GÜNCELLEME (2026-11-23):** Bu derlemeli-dosya yaması artık GEREKLİ DEĞİL.
> Tüm iyileştirmeler (60×60 kapı, 200×10 / 10×200 iç duvar varsayılanları, duvara
> mıknatıslanma, yerinde dönme, PDF kayma düzeltmesi) kaynak koda işlendi ve
> GitHub'daki `master` dalına yüklendi (commit a7736c3). Kaynaktan `npm run build`
> aldığınızda bu iyileştirmeler doğal olarak gelir; aşağıdaki dosyayı kopyalamayın.
> Bu klasör yalnızca geçmiş/reference olarak duruyor.

"Kroki Oluşturucu"nun 2D krokisi için dört iyileştirme tek dosyada toplandı:
**kapılar artık varsayılan 60×60 px, duvara mıknatıslanarak tam düz yapışıyor,
çevirince yerinde ve tam kare açıyla dönüyor, PDF'te hiçbir şey kaymıyor.**

## Kurulum (30 saniye)

```
index-BzregFHY.js  →  <projenizin>/dist/assets/index-BzregFHY.js
```

Aynı isimli derlenmiş dosyanın üzerine kopyalayın ve deploy edin. Başka hiçbir
dosyaya dokunmayın (vendor chunk'larına, CSS'e, index.html'e gerek yok —
dosya adı değişmediği için mevcut index.html aynen çalışır). Tarayıcı
önbelleğini aşmak için sayfayı **Ctrl+Shift+R** ile açın.

> DİKKAT: Kaynaktan `npm run build` alırsanız bu yama kaybolur. Kaynaktan
> derlemeniz gerekiyorsa, bu dosyadaki değişikliklerin kaynağa işlenmesi için
> bana yazın; yamalı bölge başlıkları kod içinde `snmK`, `__skipGrid` gibi
> aranabilir imzalarla işaretlidir.

## 1) Kapılar artık varsayılan 60×60 px

- **Kapı (Sağ), Kapı (Sol), Çift Kapı** sembollerinin tanımına `60×60`
  varsayılan boyutu eklendi. Artık paletten çift tıkla, paletten tutup
  sürükle-bırak — hangi yolla koyarsanız koyun **60×60** açılır (eski sürümde
  sürükle-bırakta 100×100, çift kapıda 120×60 ezik görünümdü).
- Kullanıcı kapıyı sonradan büyütür/küçültürse o boyutu aynen korunur
  (varsayılan yalnızca ilk yerleştirmede uygulanır).

## 2) Duvara mıknatıslanma (snap)

- **Geçerli semboller:** Kapı (Sağ/Sol), Çift Kapı, Pencere, Sürgülü Kapı,
  Kepenk, Duvar Geçidi, Bahçe Kapısı.
- **Yapışılan duvarlar:** İç Duvar (yatay/dikey/kısa/uzun), Bahçe Duvarı,
  Yarım Duvar/Parapet.
- Kapı duvar çizgisinin ~30 px yakınına gelince:
  - **çizgiye tam düz oturur** — kapının alt kasası duvar çizgisiyle birebir
    üst üste gelir (0 px kayma ile ölçüldü),
  - **açı duvarın açısına kilitlenir** — yatay duvara 0°, dikey duvara
    otomatik 90° dönerek yapışır; eğik duvara da duvarın açısıyla yapışır,
  - duvarın **uçlarından taşmaz** (duvar boyu içine çekilir),
  - kapı hangi açıda ise duvara **en yakın yüzü** seçilir (180° ters
    çevrilmez).
- Mıknatıslanma hem **yerleştirme anında** (palet çift tık ve sürükle-bırak)
  hem de **sürükleme sırasında** çalışır. Bıraktığınız yer ve açı aynen
  kalır; duvardan uzaklaştırırsanız serbest bırakılır.
- Yerleştirmede eski davranıştaki 20 px ızgara zorlaması, kapı duvara
  yapışacaksa uygulanmaz (yoksa tam düz oturma bozulurdu); kapısız normal
  sembollerde ızgara davranışı aynen sürer.

## 3) Çevirince tam düz ve yerinde

- **90 Derece Döndür** düğmesi artık kapıyı yerinden oynatmıyor: dönme,
  kapının **kasa hattı merkezi** etrafında yapılır; duvara bağlı kapı duvarın
  üzerinde kalır, yalnızca yönü değişir (önceden köşeden döndüğü için kapı
  fırlayıp gidiyordu).
- **Döndürme tutamacı** (seçince görünen dairesel kulp) kapı/pencere/kepenk
  gibi duvar sembollerinde **45° adımlarına yapışır** (±14° hassasiyet) —
  87.3° gibi eğik artıklar kalmaz, her zaman tam düz durur. Diğer
  sembollerde serbest açı aynen korunur.
- **Yönü Değiştir (⇄) / Açılış Yönü (⇅) / Yatay-Dikey Çevir** kapıyı yerinde
  aynalar; konumu oynatmaz.

## 4) PDF'te kayma düzeltildi

- Kök neden: PDF üretici, **aynalı** (çevrilmiş scaleX/scaleY=-1) nesneleri
  kendi genişlik/yüksekliği kadar kaydırarak çiziyordu. Sağa açılan kapıyı
  ⇄ ile sola çevirdiğinizde PDF'te kapı tam 1 kapı genişliği kaymış
  görünüyordu (tarayıcı testinde 60 px'lik kayma birebir ölçüldü).
- Dönüşüm matematiği editörünkiyle (Konva) birebir eşitlendi: 10 döndürme ×
  aynalama kombinasyonunun hepsinde PDF çizimi editörle **0 piksel** farkla
  aynı yerde çiziliyor.
- Ayrıca dikey çevrili kapının beyaz kasası da editörle aynı tarafta
  çiziliyor; kepenk/bahçe kapısı gibi çizimli semboller artık editörde de
  aynalanıyor (eskiden editör çevirmiyor, PDF çeviriyordu).

## Doğrulama (otomatik testler bu paketle doğrulandı)

- Mıknatıs matematiği: 13/13 birim testi geçti (yatay/dikey/45° eğik duvar,
  uç çekme, taraf seçimi, özel boyut…).
- PDF–editör paritesi: 10 dönüşüm/aynalama vakaında piksel piksel karşılaştırma
  — yamalı çizim 0 px fark, eski çizim 1292 px kayma üretiyordu.
- Gerçek uygulama üzerinde uçtan uca: paletten yerleştirmede 60×60 + tam düz
  yapışma (yatay ve dikey duvar, otomatik 90° dönme), sürükle-bırak
  mıknatıslanma, 90° düğme pivotu, çevirme ve PDF çıktısı konum eşleşmesi.
