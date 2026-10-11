import { headers } from "next/headers";
import { HttpError } from "./save";

const auth = require("../../auth");

export type Viewer = {
  id: string;
  email: string;
  username: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  try {
    const h = await headers();
    const cookie = h.get("cookie") || "";
    const user = await auth.currentUser({ headers: { cookie } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new HttpError(401, "unauthorized");
  return v;
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (
    origin === `https://${host}` ||
    (isLocal && origin === `http://${host}`)
  ) {
    return;
  }
  throw new HttpError(403, "invalid_origin");
}

export function safeReturnTo(raw: string | null, fallback = "/community") {
  return raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : fallback;
}
