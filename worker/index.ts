interface Env {
  ASSETS: Fetcher;
  APP_AUTH_TOKEN?: string;
}

const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const fails = new Map<string, { n: number; t: number }>();

function isRateLimited(ip: string): boolean {
  const r = fails.get(ip);
  if (!r) return false;
  if (Date.now() - r.t > WINDOW_MS) {
    fails.delete(ip);
    return false;
  }
  return r.n >= MAX_FAILS;
}

function recordFail(ip: string) {
  const r = fails.get(ip);
  if (!r || Date.now() - r.t > WINDOW_MS) fails.set(ip, { n: 1, t: Date.now() });
  else r.n++;
}

async function secretsMatch(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/verify-auth') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

      const token = env.APP_AUTH_TOKEN;
      if (!token) {
        return json({ error: 'Sunucu yapılandırma hatası. Lütfen APP_AUTH_TOKEN tanımlayın.' }, 500);
      }

      let password: unknown;
      try {
        password = ((await request.json()) as { password?: unknown }).password;
      } catch {
        return json({ error: 'Şifre gereklidir.' }, 400);
      }
      if (!password || typeof password !== 'string') {
        return json({ error: 'Şifre gereklidir.' }, 400);
      }

      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (isRateLimited(ip)) {
        return json({ error: 'Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin.' }, 429);
      }

      if (await secretsMatch(password, token)) return json({ success: true });

      recordFail(ip);
      return json({ error: 'Hatalı şifre. Lütfen tekrar deneyin.' }, 401);
    }

    return env.ASSETS.fetch(request);
  },
};
