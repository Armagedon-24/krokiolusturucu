import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Endpoint to securely verify the admin password.
 * This replaces client-side hardcoded password validation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;
    // APP_AUTH_TOKEN tanımlı değilse uygulamanın yerleşik varsayılan şifresine düş.
    const AUTH_TOKEN = process.env.APP_AUTH_TOKEN || 'Hakan_1251';

    if (!AUTH_TOKEN) {
      return res.status(500).json({ error: 'Sunucu yapılandırma hatası. Lütfen APP_AUTH_TOKEN tanımlayın.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Şifre gereklidir.' });
    }

    // Server-side secure password check
    if (password === AUTH_TOKEN) {
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Hatalı şifre. Lütfen tekrar deneyin.' });
  } catch (error: any) {
    console.error('Verify Auth Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
