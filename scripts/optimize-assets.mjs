/**
 * Varlık optimizasyonu: public/ altındaki PNG ve SVG sembolleri görsel kaliteyi
 * koruyarak küçültür. Idempotenttir; çalıştırmak: `npm run assets:optimize`
 *
 * Strateji (kalite öncelikli):
 *  - PNG (public/assets/symbols): en uzun kenarı > 800 px ise 800 px'e indirilir
 *    (Lanczos3; tuvalde en büyük yerleşim ~400 px, PDF dışa aktarma pixelRatio 2 →
 *    ihtiyaç en fazla 800 px). Sıkıştırmada iki aday üretilir:
 *      (1) Görsel-kayıpsız palet (libimagequant, quality 92 + dithering)
 *      (2) Gerçek kayıpsız (compressionLevel 9 + adaptiveFiltering)
 *    Palet adayı piksel-denetiminden geçerse (ortalama hata < 2/255 ve p99 < 48)
 *    seçilir; aksi halde kayıpsız sürüm kullanılır. Hiçbir dosya büyüyorsa yazılmaz.
 *  - PNG (symbols dışı: logo/ikon/filigran): yalnızca kayıpsız sıkıştırma, boyut değişmez.
 *  - SVG: svgo ile metaveri/Onay-Edilebilir şişkinlik temizliği (viewBox korunur).
 *
 * WEBP MODU (`node scripts/optimize-assets.mjs --webp`):
 *  Fotoğraf dokulu büyük semboller (krater, ateş, kan vb.) .webp olarak tutulur
 *  (kaynak yollar src/constants/symbols.ts içinde .webp işaretlidir). Bu mod:
 *  - public/assets altındaki .webp dosyalarını aynı görünür-hata eşikleriyle
 *    yeniden kodlar (q82, smartSubsample): yalnızca küçülüyorsa VE piksel denetimi
 *    geçiyorsa üzerine yazar (idempotent).
 *  - Kaynak png'leri DOKUNMAZ; png↔webp uzantı değişimi yapmaz.
 */
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { optimize as svgoOptimize } from 'svgo';

const ROOT = process.cwd();
const TARGETS = [
  path.join(ROOT, 'public', 'assets'),
  path.join(ROOT, 'public', 'images'),
];
const ROOT_FILES = [
  path.join(ROOT, 'public', 'logo.png'),
  path.join(ROOT, 'public', 'favicon.png'),
  path.join(ROOT, 'public', 'icon-512.png'),
];
const MAX_DIM_SYMBOL = 800;      // semboller için en uzun kenar sınırı
const PALETTE_QUALITY = 95;      // libimagequant kalite (0-100)
const MEAN_ERR_MAX = 2.0;        // GÖRÜNÜR ortalama kanal hatası eşiği (/255)
const P99_ERR_MAX = 24;          // GÖRÜNÜR %99 persentil kanal hatası eşiği
const WEBP_QUALITY = 82;         // webp yeniden kodlama kalitesi (0-100)
const WEBP_MODE = process.argv.includes('--webp');

const walk = async (dir) => {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
};

/** İki tampon arasındaki GÖRÜNÜR kanal hatası istatistikleri.
 *  Şeffaf piksellerin altındaki RGB değerleri tarayıcıda görünmez; karşılaştırma
 *  her iki görüntü de beyaz zemine birleştirilerek yapılır — aksi halde palet
 *  dönüşümü, görünmez çöp RGB nedeniyle haksızca reddedilir. */
async function visibleRaw(buf) {
  return sharp(buf).flatten({ background: '#ffffff' }).raw().toBuffer();
}

function pixelStats(a, b) {
  if (a.length !== b.length) return { ok: false };
  let sum = 0, p99 = 0;
  const n = a.length;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    hist[d]++;
  }
  let acc = 0;
  const limit = n * 0.99;
  for (let d = 0; d < 256; d++) {
    acc += hist[d];
    if (acc >= limit) { p99 = d; break; }
  }
  return { ok: true, mean: sum / n, p99 };
}

async function optimizePng(file, { allowResize }) {
  const before = (await fs.stat(file)).size;
  const img = sharp(file, { limitInputPixels: 268402689 });
  const meta = await img.metadata();

  let pipeline = sharp(file);
  let w = meta.width, h = meta.height;
  if (allowResize && Math.max(w, h) > MAX_DIM_SYMBOL) {
    const scale = MAX_DIM_SYMBOL / Math.max(w, h);
    w = Math.round(w * scale); h = Math.round(h * scale);
    pipeline = pipeline.resize(MAX_DIM_SYMBOL, MAX_DIM_SYMBOL, {
      fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3',
    });
  }

  const baseBuf = await pipeline.clone().toBuffer(); // referans (yeniden boyutlanmış) hâl
  const baseRaw = await visibleRaw(baseBuf);
  const baseMeta = await sharp(baseBuf).metadata();

  const [paletteBuf, losslessBuf] = await Promise.all([
    sharp(baseBuf).png({ palette: true, quality: PALETTE_QUALITY, effort: 10, compressionLevel: 9, dither: 1.0 }).toBuffer(),
    sharp(baseBuf).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
  ]);

  let chosen = losslessBuf, mode = 'lossless';
  if (paletteBuf.length < losslessBuf.length) {
    const palRaw = await visibleRaw(paletteBuf);
    const st = pixelStats(baseRaw, palRaw);
    if (st.ok && st.mean <= MEAN_ERR_MAX && st.p99 <= P99_ERR_MAX) {
      chosen = paletteBuf; mode = `palette(q${PALETTE_QUALITY}, mean=${st.mean.toFixed(2)}, p99=${st.p99})`;
    } else if (st.ok) {
      mode = `lossless(palette reddedildi: mean=${st.mean.toFixed(2)}, p99=${st.p99})`;
    }
  }

  if (chosen.length < before) {
    await fs.writeFile(file, chosen);
    return { file, before, after: chosen.length, mode, resized: `${meta.width}x${meta.height}->${w}x${h}` };
  }
  return { file, before, after: before, mode: 'atlandı (küçülmedi)', resized: '-' };
}

/** WEBP yeniden kodlama: yalnızca küçülme VE görünür-hata eşiği birlikte sağlanırsa yazar. */
async function reoptimizeWebp(file) {
  const before = (await fs.stat(file)).size;
  const baseRaw = await visibleRaw(file);
  const cand = await sharp(file, { limitInputPixels: 268402689 })
    .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
    .toBuffer();
  if (cand.length >= before) return { file, before, after: before, mode: 'atlandı (küçülmedi)' };
  const candRaw = await visibleRaw(cand);
  const st = pixelStats(baseRaw, candRaw);
  if (!st.ok || st.mean > MEAN_ERR_MAX || st.p99 > P99_ERR_MAX) {
    return { file, before, after: before, mode: `atlandı (kalite: mean=${st.ok ? st.mean.toFixed(2) : '-'}, p99=${st.ok ? st.p99 : '-'})` };
  }
  await fs.writeFile(file, cand);
  return { file, before, after: cand.length, mode: `webp(q${WEBP_QUALITY}, mean=${st.mean.toFixed(2)}, p99=${st.p99})` };
}

async function optimizeSvg(file) {
  const before = (await fs.stat(file)).size;
  const src = await fs.readFile(file, 'utf8');
  let result;
  try {
    result = svgoOptimize(src, {
      path: file,
      js2svg: { pretty: false, indent: 0 },
      floatPrecision: 2,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              // SVGO v4'te viewBox varsayılan olarak korunur; kimlikler bazı SVG'lerde
              // CSS/href referansları için gerekli olabilir.
              cleanupIds: { preservePrefixes: ['gradient', 'pattern', 'clip'] },
            },
          },
        },
      ],
    });
  } catch {
    return { file, before, after: before, mode: 'atlandı (ayrıştırılamadı)' };
  }
  const out = result.data;
  if (out.length < src.length && out.includes('<svg')) {
    await fs.writeFile(file, out);
    return { file, before, after: Buffer.byteLength(out), mode: 'svgo' };
  }
  return { file, before, after: before, mode: 'atlandı (küçülmedi)' };
}

async function main() {
  const files = [];
  for (const t of TARGETS) {
    try { files.push(...await walk(t)); } catch { /* klasör yok */ }
  }
  files.push(...ROOT_FILES);

  const pngs = files.filter((f) => f.toLowerCase().endsWith('.png'));
  const svgs = files.filter((f) => f.toLowerCase().endsWith('.svg'));
  const webps = files.filter((f) => f.toLowerCase().endsWith('.webp'));

  let totalBefore = 0, totalAfter = 0, changed = 0;
  const rows = [];

  if (WEBP_MODE) {
    for (const f of webps) {
      const r = await reoptimizeWebp(f);
      rows.push(r); totalBefore += r.before; totalAfter += r.after;
      if (r.after < r.before) changed++;
      if (r.before - r.after > 10_000) {
        console.log(`WEBP -${((r.before - r.after) / 1024).toFixed(0).padStart(5)}KB  ${path.relative(ROOT, r.file)}  [${r.mode}]`);
      }
    }
    console.log('──────────────────────────────────────────────');
    console.log(`WEBP modu: ${webps.length} dosya | küçülen: ${changed}`);
    console.log(`Toplam: ${(totalBefore / 1048576).toFixed(2)} MB → ${(totalAfter / 1048576).toFixed(2)} MB (-%${totalBefore ? (100 - (totalAfter / totalBefore) * 100).toFixed(1) : '0.0'})`);
    return;
  }

  for (const f of pngs) {
    const r = await optimizePng(f, { allowResize: f.includes(`${path.sep}symbols${path.sep}`) });
    rows.push(r); totalBefore += r.before; totalAfter += r.after;
    if (r.after < r.before) changed++;
    if (r.before - r.after > 40_000) {
      console.log(`PNG  -${((r.before - r.after) / 1024).toFixed(0).padStart(5)}KB  ${path.relative(ROOT, r.file)}  [${r.mode}]`);
    }
  }
  for (const f of svgs) {
    const r = await optimizeSvg(f);
    rows.push(r); totalBefore += r.before; totalAfter += r.after;
    if (r.after < r.before) changed++;
  }

  console.log('──────────────────────────────────────────────');
  console.log(`Dosya: ${pngs.length} PNG + ${svgs.length} SVG | küçülen: ${changed}`);
  console.log(`Toplam: ${(totalBefore / 1048576).toFixed(2)} MB → ${(totalAfter / 1048576).toFixed(2)} MB (-%${(100 - (totalAfter / totalBefore) * 100).toFixed(1)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
