import { createHash } from "node:crypto";
import { HttpError } from "./save";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const db = req("../../database");

export async function rateLimit(
  subject: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<void> {
  await db.ensureSchema();
  const pool = db.pool;
  if (!pool) return;

  const key = createHash("sha256").update(`comm:${subject}`).digest("hex");
  const refill = limit / windowSec;

  try {
    const result = await pool.query(
      `INSERT INTO api_rate_limits (bucket_key, tokens, updated_at)
       VALUES ($1, $2::double precision - 1, now())
       ON CONFLICT (bucket_key) DO UPDATE SET
         tokens = LEAST($2::double precision, api_rate_limits.tokens +
           GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) - 1,
         updated_at = now()
       WHERE LEAST($2::double precision, api_rate_limits.tokens +
         GREATEST(0, EXTRACT(EPOCH FROM now() - api_rate_limits.updated_at)) * $3::double precision) >= 1
       RETURNING tokens`,
      [key, limit, refill],
    );

    if (result.rowCount !== 1) {
      throw new HttpError(429, "rate_limited");
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) throw err;
    // Don't fail the request if rate-limit table has transient error
    console.error("Rate limiter warning:", err);
  }
}

export function clientIp(req: Request): string {
  const forwarded =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for");
  const val = (forwarded ? forwarded.split(",")[0].trim() : "") || "127.0.0.1";
  return val;
}
