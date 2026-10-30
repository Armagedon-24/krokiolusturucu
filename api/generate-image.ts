import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth, clientIp } from './_auth.js';

/**
 * AI Görsel Üretici — yönetici için metinden görsel üretim uç noktası.
 *
 * AKIŞ: Admin modalde görsel tarifini (prompt) ve hedef kategoriyi belirtir →
 * bu uç nokta görseli üretip base64 data URI olarak döner → admin önizlemede
 * görür → onaylarsa istemci tarafında şeffaf PNG'ye işlenip seçilen kategoriye
 * (Cloudinary klasörü) kaydedilir. Onaylanmazsa hiçbir kayıt oluşmaz.
 *
 * SAĞLAYICI ZİNCİRİ (fail-open yapılandırma):
 *  1) OPENAI_API_KEY tanımlıysa OpenAI (gpt-image-1 → dall-e-3 yedek) kullanılır.
 *  2) Anahtar yoksa Pollinations.ai (ücretsiz, anahtarsız) kullanılır.
 *     Ücretsiz katman IP başına ~45 sn'de 1 üretimle sınırlıdır; 402 durumunda
 *     kısa bekleme sonrası bir kez yeniden denenir, yine 402 dönüyorsa düzgün
 *     Türkçe açıklama ile hata verilir (Yeniden Üret düğmesi ile tekrar denenebilir).
 *
 * GÜVENLİK: verifyAuth (x-auth-token) ZORUNLU — görsel üretimi maliyetli bir
 * işlem olduğundan yalnızca yönetici oturumu kullanabilir. Ayrıca IP başına
 * bağımsız üretim hız sınırı uygulanır (giriş limiterı ile paylaşılmaz).
 */

export const maxDuration = 60;

const MAX_PROMPT_LEN = 900;
const MIN_PROMPT_LEN = 3;
const MAX_IMAGE_BYTES = 4_000_000; // Cloudinary yükleme API'si ile aynı sınır

/** Üretim hız sınırı: IP başına 5 dk içinde en fazla 12 üretim. */
const GEN_WINDOW_MS = 5 * 60 * 1000;
const GEN_MAX_PER_WINDOW = 12;
const genAttempts = new Map<string, number[]>();

function isGenerationLimited(key: string): boolean {
  const now = Date.now();
  const attempts = (genAttempts.get(key) || []).filter((t) => now - t < GEN_WINDOW_MS);
  if (attempts.length >= GEN_MAX_PER_WINDOW) {
    genAttempts.set(key, attempts);
    return true;
  }
  attempts.push(now);
  genAttempts.set(key, attempts);
  if (genAttempts.size > 500) {
    for (const [k, v] of genAttempts) {
      if (v.every((t) => now - t >= GEN_WINDOW_MS)) genAttempts.delete(k);
    }
  }
  return false;
}

/** AbortController ile zaman aşımlı fetch. */
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 22000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Buffer'ı boyut sınırına göre data URI'ye çevirir. */
function bufferToDataUri(buf: Buffer, mime: string): string {
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error('Üretilen görsel çok büyük (>4MB).');
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/* ─────────────────────────── OpenAI sağlayıcısı ─────────────────────────── */

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const models: Array<{ model: string; body: Record<string, unknown> }> = [
    { model: 'gpt-image-1', body: { model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 } },
    { model: 'dall-e-3', body: { model: 'dall-e-3', prompt, size: '1024x1024', n: 1, response_format: 'b64_json' } },
  ];

  let lastErr = 'OpenAI görsel üretimi başarısız.';
  for (const m of models) {
    try {
      const resp = await fetchWithTimeout(
        'https://api.openai.com/v1/images/generations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(m.body),
        },
        45000
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data) {
        lastErr = (data as { error?: { message?: string } })?.error?.message || `OpenAI HTTP ${resp.status}`;
        continue; // sıradaki modeli dene
      }
      const b64 = (data as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
      if (!b64) {
        lastErr = 'OpenAI yanıtı görsel içermedi.';
        continue;
      }
      const buf = Buffer.from(b64, 'base64');
      return bufferToDataUri(buf, 'image/png');
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastErr);
}

/* ──────────────────────── Pollinations sağlayıcısı ───────────────────────── */

async function generateWithPollinations(prompt: string): Promise<string> {
  // Ücretsiz katman IP başına ~45 sn'de 1 üretimle sınırlı; 402 FREE_LIMIT
  // durumunda 10 sn bekleyip TEK kez daha denenir (çift üretim istismarı değil,
  // sıradan bir "az önce başka üretim yapıldı" toparlaması).
  // POLLINATIONS_TOKEN (pollen anahtarı) tanımlıysa limitler esner — paylaşımlı
  // sunucusuz çıkış IP'lerinde (Vercel) önerilen güvenilir yoldur.
  const authHeaders: Record<string, string> = {};
  const POLLEN_TOKEN = process.env.POLLINATIONS_TOKEN;
  if (POLLEN_TOKEN && POLLEN_TOKEN.length > 5) {
    authHeaders['Authorization'] = `Bearer ${POLLEN_TOKEN}`;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const seed = crypto.randomInt(1, 2_000_000_000);
    const url =
      'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      `?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;

    let resp: Response;
    try {
      resp = await fetchWithTimeout(url, { redirect: 'follow', headers: authHeaders }, attempt === 1 ? 25000 : 22000);
    } catch {
      if (attempt === 1) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      throw new Error('Görsel üretimi zaman aşımına uğradı. Lütfen Yeniden Üret ile tekrar deneyin.');
    }

    if (resp.status === 402) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      throw new Error('Ücretsiz üretim limiti doldu (yaklaşık 45 saniyede 1 görsel). Kısa bir süre sonra Yeniden Üret deyin veya sınırsız üretim için Vercel ortam değişkenlerine OPENAI_API_KEY ekleyin.');
    }

    if (!resp.ok) {
      if (attempt === 1) { await new Promise((r) => setTimeout(r, 2500)); continue; }
      throw new Error(`Görsel üretim servisi hata verdi (HTTP ${resp.status}). Yeniden Üret ile tekrar deneyin.`);
    }

    const mime = resp.headers.get('content-type') || '';
    if (!mime.startsWith('image/')) {
      if (attempt === 1) { await new Promise((r) => setTimeout(r, 2500)); continue; }
      throw new Error('Görsel üretim servisi beklenmeyen bir yanıt döndürdü.');
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 1000) {
      if (attempt === 1) { await new Promise((r) => setTimeout(r, 2500)); continue; }
      throw new Error('Üretilen görsel boş geldi. Yeniden Üret ile tekrar deneyin.');
    }
    return bufferToDataUri(buf, mime.split(';')[0]);
  }
  // Ulaşılmaz yol
  throw new Error('Görsel üretilemedi.');
}

/* ─────────────────────────────── Handler ────────────────────────────────── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!verifyAuth(req, res)) {
      return;
    }

    if (isGenerationLimited(clientIp(req))) {
      return res.status(429).json({
        error: 'Çok fazla üretim denemesi. Lütfen birkaç dakika sonra tekrar deneyin.',
      });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const promptRaw = (body as { prompt?: unknown }).prompt;

    if (!promptRaw || typeof promptRaw !== 'string') {
      return res.status(400).json({ error: 'Görsel tarifi (prompt) gereklidir.' });
    }
    const prompt = promptRaw.trim().replace(/\s+/g, ' ');
    if (prompt.length < MIN_PROMPT_LEN) {
      return res.status(400).json({ error: 'Görsel tarifi çok kısa. Lütfen biraz daha ayrıntı yazın.' });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return res.status(400).json({ error: `Görsel tarifi çok uzun (en fazla ${MAX_PROMPT_LEN} karakter).` });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    let dataUri: string;
    let provider: string;

    if (OPENAI_KEY && OPENAI_KEY.length > 10) {
      try {
        dataUri = await generateWithOpenAI(prompt, OPENAI_KEY);
        provider = 'openai';
      } catch (openAiErr) {
        // OpenAI başarısızsa ücretsiz sağlayıcıya düş (hizmet sürekliliği)
        console.error('OpenAI generation failed, falling back to Pollinations:', openAiErr);
        dataUri = await generateWithPollinations(prompt);
        provider = 'pollinations';
      }
    } else {
      dataUri = await generateWithPollinations(prompt);
      provider = 'pollinations';
    }

    return res.status(200).json({ dataUri, provider });
  } catch (error: unknown) {
    console.error('Generate Image Error:', error);
    const msg = error instanceof Error ? error.message : 'Sunucu hatası';
    return res.status(500).json({ error: msg });
  }
}
