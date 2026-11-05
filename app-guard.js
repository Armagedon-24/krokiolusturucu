/**
 * Anti-Copy / Anti-Inspect koruması.
 * Not: Bu tür önlemler istemcide her zaman atlatılabilir; amaç sıradan kopyalama
 * girişimlerini caydırmaktır. Güvenlik başlıkları (CSP vb.) Vercel tarafında
 * vercel.json ile zorlanır; Electron sürümünde bu dosya dist/ ile birlikte taşınır.
 */
document.addEventListener('contextmenu', function (event) {
  event.preventDefault();
});
document.onkeydown = function (e) {
  if (e.keyCode == 123) return false; // F12
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false;
  if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
};

// Sayfaya dış dosya sürükle-bırak ile müdahaleyi engelle (tuval drop'u kendi işleyicisinde)
window.addEventListener('dragover', function (e) { e.preventDefault(); }, false);
window.addEventListener('drop', function (e) { e.preventDefault(); }, false);
