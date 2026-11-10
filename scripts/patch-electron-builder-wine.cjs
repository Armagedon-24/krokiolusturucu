/**
 * electron-builder wine yaması (idempotent).
 *
 * Sorun: NSIS hedefinde uninstaller exe'yi üretmek için electron-builder,
 * yarı bitmiş kurulum programını WINE altında çalıştırır (Linux'ta wine yok → hata).
 *
 * Çözüm: NsisTarget.js içindeki `isMacOsCatalina()` koşulu `true` yapılarak
 * saf JS uygulaması UninstallerReader.exec() (PE başlıklarını bayt düzeyinde
 * okuyup uninstaller'ı çıkarır) her platformda zorunlu kılınır. Wine gerekmez.
 *
 * - Windows'ta no-op (wine zaten gerekmez, orijinal akış çalışır).
 * - `npm ci` sonrası taze node_modules üzerinde yeniden çalıştırılmalıdır;
 *   electron:build script'i bunu otomatik yapar.
 * - Zaten uygulanmışsa sessizce geçer.
 */
const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  console.log('[wine-patch] Windows üzerinde gerek yok — atlandı.');
  process.exit(0);
}

const target = path.join(
  __dirname, '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js',
);

if (!fs.existsSync(target)) {
  console.error('[wine-patch] NsisTarget.js bulunamadı — electron-builder kurulu mu?');
  process.exit(1);
}

const MARK = "PATCH: wine'sız uninstaller üretimi";
const ORIGINAL = 'if ((0, macosVersion_1.isMacOsCatalina)()) {';
const PATCHED = 'if (true) { // ' + MARK + ' — UninstallerReader saf JS, wine gerekmez';

let src = fs.readFileSync(target, 'utf8');
if (src.includes(MARK)) {
  console.log('[wine-patch] Zaten uygulanmış — değişiklik yok.');
  process.exit(0);
}
if (!src.includes(ORIGINAL)) {
  console.error('[wine-patch] Beklenen satır bulunamadı — electron-builder sürümü değişmiş olabilir. Elle kontrol edin.');
  process.exit(1);
}
src = src.replace(ORIGINAL, PATCHED);
fs.writeFileSync(target, src);
console.log('[wine-patch] Uygulandı:', target);
