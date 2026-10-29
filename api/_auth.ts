import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Common authentication helper to verify the x-auth-token header.
 * Centrally manages the authentication token for all active APIs.
 */
export function verifyAuth(req: VercelRequest, res: VercelResponse): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const AUTH_TOKEN = process.env.APP_AUTH_TOKEN || (isProduction ? undefined : 'Hakan_1251');
  const clientToken = req.headers['x-auth-token'];
  
  if (!AUTH_TOKEN) {
    res.status(500).json({ error: 'Sunucu yapılandırma hatası. Lütfen APP_AUTH_TOKEN tanımlayın.' });
    return false;
  }
  
  if (!clientToken || clientToken !== AUTH_TOKEN) {
    res.status(401).json({ error: 'Yetkisiz erişim. Lütfen admin girişi yapın.' });
    return false;
  }
  return true;
}
