import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

/**
 * Ortak kimlik doğrulama yardımcısı: x-auth-token başlığını doğrular.
 * GÜVENLİK: Varsayılan parola fallback'i YOK — APP_AUTH_TOKEN tanımlı değilse
 * tüm API'ler 500 ile KAPALI konuma düşer (fail-closed). Aksi halde kaynak koda
 * gömülü bir parola, deposu gören herkesin yetkisini ele geçirmesine yol açar.
 */

/** Sunucu tarafında etkin auth token'ı döndürür; tanımlı değilse null. */
export function getAuthToken(): string | null {
  const token = process.env.APP_AUTH_TOKEN;
  return token && token.length > 0 ? token : null;
}

/**
 * Sabit zamanlı (timing-safe) gizli karşılaştırma.
 * Uzunluk farkı leak etmemek için iki taraf da sha256 ile özetlenir.
 */
export function secretsMatch(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Verify-auth için basit bellek-içi hız sınırlayıcı (instance başına, best-effort). */
const loginAttempts = new Map<string, number[]>();
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 dakika
const RATE_MAX_ATTEMPTS = 10;          // 5 dk içinde en fazla 10 deneme

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (attempts.length >= RATE_MAX_ATTEMPTS) {
    loginAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  loginAttempts.set(key, attempts);
  // Haritanın sınırsız büyümesini engelle
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) loginAttempts.delete(k);
    }
  }
  return false;
}

/** İstemci IP'sini Vercel başlıklarından çıkarır. */
export function clientIp(req: VercelRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length > 0) return String(xf[0]);
  return 'anon';
}

/**
 * Tüm mutasyon yapan API'ler için merkezi auth kontrolü.
 * Yetkisiz/hatalı yapılandırma durumunda yanıt yazılır ve false döner.
 */
export function verifyAuth(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Cache-Control', 'no-store');

  const AUTH_TOKEN = getAuthToken();
  if (!AUTH_TOKEN) {
    res.status(500).json({ error: 'Sunucu yapılandırma hatası. Lütfen APP_AUTH_TOKEN tanımlayın.' });
    return false;
  }

  const clientToken = req.headers['x-auth-token'];
  const tokenStr = Array.isArray(clientToken) ? clientToken[0] : clientToken;

  if (!tokenStr || !secretsMatch(tokenStr, AUTH_TOKEN)) {
    res.status(401).json({ error: 'Yetkisiz erişim. Lütfen admin girişi yapın.' });
    return false;
  }
  return true;
}
