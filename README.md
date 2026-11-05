# Kroki Oluşturucu

Trafik kazası ve adli olay kroki çizim uygulaması (React + TypeScript + Vite + Vercel Serverless + Cloudinary).

**Canlı adres:** https://kroki-olusturucu.vercel.app

## Geliştirme

```bash
npm install        # bağımlılıklar
npm run dev        # yerel geliştirme (API'ler vite middleware olarak çalışır)
npm run build      # tip denetimi + üretim derlemesi (dist/)
npm run lint       # eslint
npm run preview    # derlemeyi yerelde önizle
```

## Ortam Değişkenleri (Vercel)

| Değişken | Zorunlu? | Açıklama |
| --- | --- | --- |
| `APP_AUTH_TOKEN` | Zorunlu | Admin şifresi (tüm `/api/*` uçları fail-closed'dur). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Zorunlu | Görsellerin kategori klasörlerine yüklenmesi ve bulut senkronu için. |

## Varlık Optimizasyonu

`public/assets` altındaki PNG/SVG sembolleri görsel kaliteyi koruyarak küçültür
(>800 px semboller Lanczos3 ile indirilir; paletli sıkıştırma yalnızca görünür
piksel hatası eşikten geçerse uygulanır):

```bash
npm run assets:optimize
```

## Masaüstü (Offline) Sürüm — Windows Kurulum Paketi

Uygulama, internet olmadan çalışabilen kurulabilir bir Windows programı olarak derlenebilir
(Electron 33 ile paketlenir; arayüz yerel `127.0.0.1` HTTP sunucusu üzerinden yüklenir).

```bash
npm ci
npm run electron:build
# → release/Kroki-Olusturucu-Setup-1.0.0-x64.exe    (kurulum sihirbazı)
# → release/Kroki-Olusturucu-Portable-1.0.0-x64.exe (kurulumsuz tek dosya)
```

**Offline çalışma kapsamı:**

- ✅ Tamamen yerel: kroki çizimi (Konva), sembol kütüphanesi, tüm hesaplayıcılar,
  bilirkişi raporu PDF'i (jsPDF + gömülü Liberation fontları), Inter/Roboto arayüz
  fontları (Google Fonts kaldırıldı, `src/offline-fonts.css` ile yerel woff2).
- ⚠️ İnternet gerektiren isteğe bağlı özellikler: uydu haritası kutuları ve geokodlama,
  bulut galeri/kanıt yükleme (`/api/*` + Cloudinary). Bunlar çevrimdışında sessizce
  başarısız olur; çekirdek işlevleri etkilemez.

**Teknik notlar:**

- Linux/macOS üzerinde derleme wine gerektirmez: `scripts/patch-electron-builder-wine.cjs`,
  uninstaller üretimini saf JS olan `UninstallerReader.exec()` yoluna zorlar
  (`electron:build` betiği bunu otomatik uygular; idempotenttir, Windows'ta no-op).
- `win.signAndEditExecutable: false` olduğu için exe kaynağı rcedit ile düzenlenmez;
  pencere/görev çubuğu ikonu çalışma anında `BrowserWindow.icon` ile verilir,
  kurulum/portable exe ikonu NSIS tarafından `build/icon.png`'den basılır.
- Paket imzalı değildir: ilk kurulumda Windows SmartScreen uyarısı çıkabilir
  ("Daha fazla bilgi → Yine de çalıştır").
