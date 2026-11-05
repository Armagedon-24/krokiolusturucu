/**
 * @vercel/node tip shim'i.
 *
 * Gerçek @vercel/node paketi yalnızca tip sağlıyordu ama denetimde yüksek
 * önemli güvenlik açığı zinciri (@fastify/busboy → undici) taşıyordu. Paket
 * kaldırıldı; api/*.ts'in kullandığı minimum istek/yanıt yapısı burada
 * yapısal olarak tanımlanır. Vercel çalışma anı kendi gerçek tiplerini
 * kullanır — bu dosya yalnızca derleme/editör içindir.
 */

export interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  body?: unknown;
}

export interface VercelResponse {
  status(statusCode: number): VercelResponse;
  json(data: unknown): void;
  send(data: unknown): void;
  setHeader(name: string, value: string | string[]): VercelResponse;
  getHeader(name: string): string | string[] | undefined;
}
