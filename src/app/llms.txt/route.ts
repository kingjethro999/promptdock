import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  const origin = process.env.APP_URL || "https://thepromptdock.vercel.app";
  const raw = await readFile(join(process.cwd(), "src", "llms.txt"), "utf8");
  return new Response(raw.replaceAll("{{SITE_URL}}", origin), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
