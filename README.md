# Kroki Oluşturucu

Trafik kazası ve adli olay kroki çizim uygulaması (React + TypeScript + Vite + Vercel Serverless + Cloudinary).

## Ortam Değişkenleri (Vercel)

| Değişken | Zorunlu? | Açıklama |
| --- | --- | --- |
| `APP_AUTH_TOKEN` | Zorunlu | Admin şifresi (tüm `/api/*` uçları fail-closed'dur). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Zorunlu | Görsellerin kategori klasörlerine yüklenmesi ve bulut senkronu için. |

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

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
