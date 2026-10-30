# Kroki Oluşturucu

Trafik kazası ve adli olay kroki çizim uygulaması (React + TypeScript + Vite + Vercel Serverless + Cloudinary).

## AI Görsel Üretici (Yönetici Özelliği)

Admin girişi yapıldıktan sonra üst bardaki **GÖRSEL ÜRET** düğmesi (veya sol menüde her kategori başlığındaki **AI** düğmesi) ile yapay zekâ destekli görsel üretimi yapılır:

1. Yönetici, üretmek istediği görseli **tarif eder** ve görselin **kaydedileceği kategoriyi** seçer.
2. Görsel üretilir ve yöneticiye **önizlenir** (beyaz zemin otomatik olarak şeffaflaştırılır).
3. Yönetici **onaylarsa** görsel, seçilen kategorinin Cloudinary klasörüne (`kroki-olusturucu/<kategori>/`) kaydedilir ve kütüphanede o kategoride yerini alır. Onaylamazsa hiçbir kayıt oluşmaz.

### Sağlayıcı Yapılandırması (Vercel ortam değişkenleri)

| Değişken | Zorunlu? | Açıklama |
| --- | --- | --- |
| `OPENAI_API_KEY` | İsteğe bağlı | Tanımlıysa OpenAI (gpt-image-1, yedekte dall-e-3) kullanılır. Tanımlı değilse ücretsiz Pollinations.ai devreye girer (yaklaşık 45 saniyede 1 üretim limiti vardır). |
| `POLLINATIONS_TOKEN` | İsteğe bağlı | Pollinations "pollen" anahtarı — ücretsiz katmanın IP bazlı üretim limitini esnetir (paylaşımlı sunucusuz çıkış IP'leri için önerilir). |
| `APP_AUTH_TOKEN` | Zorunlu | Admin şifresi (tüm `/api/*` uçları fail-closed'dur). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Zorunlu | Onaylanan görsellerin kategori klasörlerine yüklenmesi için. |

Üretim uç noktası: `POST /api/generate-image` — yalnızca yönetici oturumu (`x-auth-token`) ile çağrılabilir; IP başına hız sınırı uygulanır.

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
