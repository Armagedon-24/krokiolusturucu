import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthToken, secretsMatch, isRateLimited, clientIp } from './_auth.js';

/**
 * Admin parolasını doğrulayan uç nokta.
 * GÜVENLİK: Varsayılan parola fallback'i kaldırıldı (fail-closed) + hız sınırı +
 * sabit zamanlı karşılaştırma. Parola asla yanıtta geri dönmez.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const AUTH_TOKEN = getAuthToken();
    if (!AUTH_TOKEN) {
      return res.status(500).json({ error: 'Sunucu yapılandırma hatası. Lütfen APP_AUTH_TOKEN tanımlayın.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const password = (body as { password?: unknown }).password;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Şifre gereklidir.' });
    }

    // Kaba kuvvet denemelerini sınırla (instance başına best-effort)
    if (isRateLimited(clientIp(req))) {
      return res.status(429).json({ error: 'Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin.' });
    }

    if (secretsMatch(password, AUTH_TOKEN)) {
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Hatalı şifre. Lütfen tekrar deneyin.' });
  } catch (error: unknown) {
    console.error('Verify Auth Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
