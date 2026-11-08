/**
 * Node çalıştırıcı: tarayıcı polyfill'leri + cloud.load mock + test dosyası.
 * esbuild ile bundle edilip node ile çalıştırılır.
 */

// --- Polyfill'ler (store import edilmeden ÖNCE) -------------------------------
class MemoryLS {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}
const g = global as any;
const memoryLS = new MemoryLS();
g.localStorage = memoryLS;
// hostname 'localhost' → syncToCloud geliştirme aşamasında erken döner (ağ yok)
// NOT: uygulama persist için window.localStorage kullanır — window'a da takın.
g.window = { location: { hostname: 'localhost' }, localStorage: memoryLS };
try { Object.defineProperty(g, 'navigator', { value: { userAgent: 'node-test' }, configurable: true }); }
catch { /* navigator salt-okunur ise olduğu gibi bırak */ }
g.document = {
  addEventListener: () => {}, removeEventListener: () => {},
  createElement: () => ({ style: {}, setAttribute: () => {} }),
  activeElement: null,
};
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.location = { hostname: 'localhost' };

// --- cloud.load mock ----------------------------------------------------------
// Gerçek ağ çağrıları yerine test senaryosunun hazırladığı __mockCloudData döner.
import { cloudinary } from '../src/lib/cloudinary';
(cloudinary as any).load = async () => (g.__mockCloudData ?? null);

// Gerçek fetch'e izin yok (yanlışlıkla ağ çağrısı testi bozar)
g.fetch = async () => { throw new Error('AĞ ÇAĞRISI BEKLENMEDİK'); };

// --- Testleri çalıştır --------------------------------------------------------
await import('./test-category-fix');
