const ALLOWED_HOSTS = new Set([
  "avatars.githubusercontent.com",
  "lh3.googleusercontent.com",
  "googleusercontent.com",
]);

/** Returns a data URI or null. Never throws, never blocks longer than 1.5 s. */
export async function safeAvatar(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(1500) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|webp)$/.test(type)) return null; // no SVG: avoids script and size surprises
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 400_000) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}
