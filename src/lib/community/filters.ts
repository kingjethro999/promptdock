export type Sort = "new" | "old" | "saved";

export function normalizeTag(t: string): string {
  if (!t || typeof t !== "string") return "";
  return t
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

export function canonicalKey(sp: URLSearchParams): string {
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const tags = [...new Set(sp.getAll("tag").map(normalizeTag))]
    .filter(Boolean)
    .sort();
  const sort = (sp.get("sort") as Sort) || "new";
  const creatorId = (sp.get("creatorId") ?? "").trim();

  const u = new URLSearchParams();
  if (q) u.set("q", q);
  tags.forEach((t) => u.append("tag", t));
  if (sort !== "new") u.set("sort", sort);
  if (creatorId) u.set("creatorId", creatorId);

  return u.toString();
}
