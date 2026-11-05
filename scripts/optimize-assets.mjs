/**
 * VARLIK OPTİMİZASYONU v4 — sembol görselleri: akıllı boyut + format seçimi
 *
 * Politika (görsel kalite KORUNUR):
 *  1. Daha önce WebP'ye dönüşmüş dosyaların PNG ikizleri silinir.
 *  2. 512px'i aşan semboller Lanczos3 ile 512px'e indirilir (tuval ~150px,
 *     PDF export pixelRatio 2 ≈ 400px → 512px baskıda dahi güvenli marj).
 *  3. Adaylar: pngquant palet PNG (--quality=70-95 kapısı: hedefe ulaşamazsa
 *     yazmaz) ve WebP q92. WebP için piksel hatası ALPHA-MASKELİ ölçülür
 *     (görünmez yarı-şeffaf pikseller hesaba katılmaz): ağırlıklı ortalama
 *     Δ ≤ 2.0/255 ve p99 Δ ≤ 30/255 geçmek zorundadır.
 *  4. Geçen en küçük aday, yalnızca orijinalden küçükse yazılır.
 *  5. Manifest → yeniden koşuya güvenli (idempotent).
 *
 * Kullanım: npm run assets:optimize
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import pngquantPath from 'pngquant-bin';

const ROOT = path.resolve(process.cwd(), 'public/assets');
const SKIP_DIRS = new Set(['fonts']);
const MAX_DIM = 512;
const MIN_BYTES = 10 * 1024;
const MEAN_MAX = 2.0;
const P99_MAX = 30;
const CACHE_DIR = path.resolve(process.cwd(), 'node_modules/.cache');
const MANIFEST = path.join(CACHE_DIR, 'assets-optimizer.json');
const CHANGED_EXT = path.join(CACHE_DIR, 'assets-changed-ext.json');

/** Alpha-maskeli algısal piksel farkı (görünmez pikseller sayılmaz) */
async function maskedErr(refBuf, candBuf) {
  const r = await sharp(refBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = await sharp(candBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = Math.min(r.data.length, c.data.length);
  const s = [];
  let sum = 0, cnt = 0;
  for (let i = 0; i < n; i += 4) {
    if (Math.min(r.data[i + 3], c.data[i + 3]) < 16) continue;
    const d = Math.abs(r.data[i] - c.data[i]) * 0.3
      + Math.abs(r.data[i + 1] - c.data[i + 1]) * 0.5
      + Math.abs(r.data[i + 2] - c.data[i + 2]) * 0.2;
    const da = Math.abs(r.data[i + 3] - c.data[i + 3]) * 0.4;
    const v = Math.max(d, da);
    sum += v; s.push(v); cnt++;
  }
  if (!cnt) return { mean: 0, p99: 0 };
  s.sort((x, y) => x - y);
  return { mean: sum / cnt, p99: s[Math.floor(s.length * 0.99)] };
}

async function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), acc);
    } else if (/\.png$/i.test(e.name)) acc.push(path.join(dir, e.name));
  }
  return acc;
}

fs.mkdirSync(CACHE_DIR, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const changedExt = fs.existsSync(CHANGED_EXT) ? JSON.parse(fs.readFileSync(CHANGED_EXT, 'utf8')) : [];

// ADIM 1: WebP ikizi olan PNG'leri sil
const allPng = await walk(ROOT);
let removedTwins = 0;
for (const f of allPng) {
  const wp = f.replace(/\.png$/i, '.webp');
  if (fs.existsSync(wp)) {
    fs.unlinkSync(f);
    const rel = path.relative(ROOT, f);
    if (!manifest[rel]) { manifest[rel] = { to: 'webp(önceki)' }; changedExt.push(rel); }
    removedTwins++;
  }
}

// ADIM 2: kalan PNG'leri işle
const files = await walk(ROOT);
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'assetopt-'));
let processed = 0, failed = 0, bytesBefore = 0, bytesAfter = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const size = fs.statSync(f).size;
  bytesBefore += size;
  bytesAfter += size;
  if (manifest[rel]) continue;
  if (size < MIN_BYTES) { manifest[rel] = { skip: 'küçük' }; continue; }

  try {
    const meta = await sharp(f).metadata();
    if (meta.palette && Math.max(meta.width, meta.height) <= MAX_DIM) {
      manifest[rel] = { skip: 'paletli-optimal' };
      continue;
    }
    const needResize = Math.max(meta.width, meta.height) > MAX_DIM;

    // çalışma dosyası: gerekirse 512'ye indirilmiş kayıpsız PNG
    let workBuf = fs.readFileSync(f);
    if (needResize) {
      workBuf = await sharp(f).resize(MAX_DIM, MAX_DIM, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    }
    const workPath = path.join(tmpBase, 'work.png');
    fs.writeFileSync(workPath, workBuf);

    const cands = [];

    // Aday A: pngquant (kalite kapılı)
    try {
      const outQ = path.join(tmpBase, 'q.png');
      execFileSync(pngquantPath, ['--quality=70-95', '--speed', '3', '--force', '--output', outQ, workPath], { stdio: 'ignore' });
      if (fs.existsSync(outQ)) {
        const buf = fs.readFileSync(outQ);
        cands.push({ name: 'pngquant', buf, pass: true }); // kendi kalite kapısı var
      }
    } catch { /* pngquant yazamadı: kalite hedefi tutmadı */ }

    // Aday B: WebP q92 (maskeli hata kapısıyla)
    try {
      const buf = await sharp(workPath).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 4 }).toBuffer();
      const st = await maskedErr(workBuf, buf);
      cands.push({ name: 'webp', buf, pass: st.mean <= MEAN_MAX && st.p99 <= P99_MAX, err: st });
    } catch { /* webp başarısız */ }

    const passing = cands.filter((c) => c.pass && c.buf.length < size).sort((a, b) => a.buf.length - b.buf.length);
    const chosen = passing[0];
    if (!chosen) { manifest[rel] = { skip: 'kazanç yok' }; continue; }

    const toWebp = chosen.name === 'webp';
    const outPath = toWebp ? f.replace(/\.png$/i, '.webp') : f;
    fs.writeFileSync(outPath, chosen.buf);
    if (toWebp) fs.unlinkSync(f);

    bytesAfter = bytesAfter - size + chosen.buf.length;
    if (toWebp) changedExt.push(rel);
    manifest[rel] = { to: chosen.name, before: size, after: chosen.buf.length, ...(chosen.err ? { mean: +chosen.err.mean.toFixed(2), p99: +chosen.err.p99.toFixed(1) } : {}) };
    processed++;
  } catch (err) {
    failed++;
    console.error(`HATA ${rel}: ${err.message}`);
  }
}

// ADIM 3: 512px'i aşan WebP'leri yeniden boyutlandır (maskeli hata kapısıyla)
let webpResized = 0;
async function walkWebp(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walkWebp(path.join(dir, e.name), acc);
    } else if (/\.webp$/i.test(e.name)) acc.push(path.join(dir, e.name));
  }
  return acc;
}
const webpFiles = await walkWebp(ROOT);
for (const f of webpFiles) {
  const rel = path.relative(ROOT, f);
  const mkey = rel + '::webp-resize';
  if (manifest[mkey]) continue;
  try {
    const size = fs.statSync(f).size;
    const meta = await sharp(f).metadata();
    if (Math.max(meta.width, meta.height) <= MAX_DIM) { manifest[mkey] = { skip: 'boyut uygun' }; continue; }
    const ref = await sharp(f).resize(MAX_DIM, MAX_DIM, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    const buf = await sharp(ref).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 4 }).toBuffer();
    if (buf.length >= size) { manifest[mkey] = { skip: 'kazanç yok' }; continue; }
    const st = await maskedErr(ref, buf);
    if (st.mean > MEAN_MAX || st.p99 > P99_MAX) { manifest[mkey] = { skip: 'hata kapısı', mean: +st.mean.toFixed(2), p99: +st.p99.toFixed(1) }; continue; }
    fs.writeFileSync(f, buf);
    manifest[mkey] = { to: 'webp-512', before: size, after: buf.length };
    bytesAfter += buf.length - size;
    webpResized++;
  } catch (err) {
    console.error(`HATA(webp) ${rel}: ${err.message}`);
  }
}

fs.rmSync(tmpBase, { recursive: true, force: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
fs.writeFileSync(CHANGED_EXT, JSON.stringify([...new Set(changedExt)], null, 1));

console.log(`WebP ikizi silinen PNG: ${removedTwins}`);
console.log(`Kalan PNG: ${files.length} | yeniden kodlanan: ${processed} | hata: ${failed}`);
console.log(`PNG toplamı: ${(bytesBefore / 1048576).toFixed(1)}MB → ${(bytesAfter / 1048576).toFixed(1)}MB (-${bytesBefore ? (100 - (bytesAfter / bytesBefore) * 100).toFixed(0) : 0}%)`);
console.log(`512pxe indirilen webp: ${webpResized}`);
console.log(`Uzantı değişen (webp) toplam: ${new Set(changedExt).size}`);
