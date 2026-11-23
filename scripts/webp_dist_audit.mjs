#!/usr/bin/env node
/** dist denetimi: üretilen tüm JS/CSS/HTML'deki /assets/... , /logo..., /favicon...,
 *  /icon-512... yol literallerini çıkarır ve karşılıklarının dist/ içinde var
 *  olduğunu doğrular. Eksik varlık = kırık görsel demektir; rapor verir. */
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = '/home/z/my-project/master-src/dist';

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const files = (await walk(ROOT)).filter((f) => /\.(js|css|html|webmanifest|json)$/.test(f));
const re = /(?:["'`(]|=)((?:https?:\/\/[^"'`\s)]+)?\/(?:assets\/[A-Za-z0-9_\-./]+|(?:logo|favicon|icon-512|apple-touch-icon)\.[a-z]+))(?:["'`)\s])/g;

const refs = new Map(); // yol -> [{file}]
for (const f of files) {
  const text = await fs.readFile(f, 'utf8');
  let m;
  while ((m = re.exec(text))) {
    // Eşitlik karşılaştırması / endsWith gibi mantıksal kullanımlar görsel yüklemesi değildir
    // (ör. migrateLegacyAssetUrl içindeki url === '/logo.png' eski kayıt eşlemesi).
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/===|!==|endsWith\($|\.endsWith\($/.test(before)) continue;
    let url = m[1];
    if (url.startsWith('http')) {
      // yalnızca yerel dağıtım kökünü işaretle (cloudinary/osm dışarıda kalır)
      if (!/res\.cloudinary\.com|openstreetmap|arcgisonline|yandex/i.test(url)) {
        try { url = new URL(url).pathname; } catch { continue; }
      } else continue;
    }
    const clean = url.split('?')[0].split('#')[0];
    if (!/^\/(assets\/|logo\.|favicon\.|icon-512\.)/.test(clean)) continue;
    if (!refs.has(clean)) refs.set(clean, []);
    refs.get(clean).push(path.relative(ROOT, f));
  }
}

let missing = 0;
const rows = [...refs.entries()].sort();
for (const [url, srcs] of rows) {
  const p = path.join(ROOT, url);
  let ok = false;
  try { ok = (await fs.stat(p)).isFile(); } catch { /* yok */ }
  if (!ok) {
    missing++;
    console.log(`EKSIK: ${url}  (kullanan: ${srcs.slice(0, 2).join(', ')}${srcs.length > 2 ? ' …' : ''})`);
  }
}

const webp = rows.filter(([u]) => u.endsWith('.webp')).length;
const png = rows.filter(([u]) => u.endsWith('.png')).length;
const svg = rows.filter(([u]) => u.endsWith('.svg')).length;
console.log(`\nDenetlenen benzersiz varlık yolu: ${rows.length} (webp: ${webp}, png: ${png}, svg: ${svg})`);
console.log(missing === 0 ? 'SONUÇ: TÜM REFERANSLAR dist/ İÇİNDE VAR — kırık yol yok' : `SONUÇ: ${missing} EKSİK VARLIK!`);
process.exit(missing === 0 ? 0 : 1);
