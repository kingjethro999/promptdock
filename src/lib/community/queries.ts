import { randomBytes } from "node:crypto";
import {
  visibleToViewerSql,
  GLOBAL_FEED_SQL,
  type Visibility,
  type Audience,
} from "./access.ts";
import {
  validateUsername,
  normalizeUsername,
  RESERVED,
  USERNAME_RE,
} from "./username.ts";
import type { CommunityPromptCard, PublicProfile, Page } from "./types";

import { createRequire } from "node:module";

const requireModule = createRequire(import.meta.url);
const db = requireModule("../../database");

export type PromptRecord = {
  id: string;
  publicId: string;
  ownerId: string;
  name: string;
  data: {
    task?: string;
    depth?: string;
    rules?: string[];
    [key: string]: unknown;
  };
  tags: string[];
  visibility: Visibility;
  listedInCommunity: boolean;
  listedAt: string | null;
  updatedAt: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  communityAudience: Audience;
};

/** The only way a prompt is fetched by public id. Missing and forbidden are indistinguishable, by design. */
export async function getPromptForViewer(
  publicId: string,
  viewerId: string | null,
): Promise<PromptRecord | null> {
  if (
    !publicId ||
    typeof publicId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(publicId)
  )
    return null;
  if (!db.pool) return null;
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT p.id, p.public_id AS "publicId", p.owner_id AS "ownerId", p.name, p.data, p.tags,
            COALESCE(p.visibility, 'public') AS "visibility", p.listed_in_community AS "listedInCommunity", p.listed_at AS "listedAt", p.updated_at AS "updatedAt",
            u.username, COALESCE(u.display_name, u.username, p.owner_username) AS "displayName", u.avatar_url AS "avatarUrl", COALESCE(u.community_audience, 'public') AS "communityAudience"
       FROM prompts p LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.public_id = $1::uuid AND p.deleted_at IS NULL AND ${visibleToViewerSql("$2")}`,
    [publicId, viewerId],
  );
  return rows[0] ?? null;
}

/** Fetch a prompt by primary internal ID for a viewer (used for attribution check). */
export async function getPromptByIdForViewer(
  id: string,
  viewerId: string | null,
): Promise<PromptRecord | null> {
  if (!id || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
    return null;
  if (!db.pool) return null;
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT p.id, p.public_id AS "publicId", p.owner_id AS "ownerId", p.name, p.data, p.tags,
            COALESCE(p.visibility, 'public') AS "visibility", p.listed_in_community AS "listedInCommunity", p.listed_at AS "listedAt", p.updated_at AS "updatedAt",
            u.username, COALESCE(u.display_name, u.username, p.owner_username) AS "displayName", u.avatar_url AS "avatarUrl", COALESCE(u.community_audience, 'public') AS "communityAudience"
       FROM prompts p LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1::uuid AND p.deleted_at IS NULL AND ${visibleToViewerSql("$2")}`,
    [id, viewerId],
  );
  return rows[0] ?? null;
}

export async function resolveHandle(
  raw: string,
): Promise<{ userId: string; username: string } | null> {
  const handle = normalizeUsername(raw);
  if (!USERNAME_RE.test(handle) || RESERVED.has(handle)) return null;
  await db.ensureSchema();

  const userRes = await db.pool.query(
    `SELECT id, username FROM users WHERE lower(username) = $1`,
    [handle],
  );
  if (userRes.rows[0]) {
    return { userId: userRes.rows[0].id, username: userRes.rows[0].username };
  }

  const aliasRes = await db.pool.query(
    `SELECT a.user_id AS "userId", u.username
     FROM username_aliases a
     JOIN users u ON u.id = a.user_id
     WHERE lower(a.alias) = $1`,
    [handle],
  );
  if (aliasRes.rows[0]) {
    return {
      userId: aliasRes.rows[0].userId,
      username: aliasRes.rows[0].username,
    };
  }

  return null;
}

export async function allocateUsername(
  userId: string,
  base: string,
): Promise<string> {
  await db.ensureSchema();
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0
        ? base
        : `${base}-${randomBytes(3)
            .toString("hex")
            .slice(0, attempt < 5 ? 2 : 4)}`;
    if (!validateUsername(candidate).ok) continue;
    try {
      const r = await db.pool.query(
        `UPDATE users SET username = $2, display_name = COALESCE(display_name, $2)
          WHERE id = $1 AND username IS NULL
            AND NOT EXISTS (SELECT 1 FROM username_aliases WHERE alias = $2)
        RETURNING username`,
        [userId, candidate],
      );
      if (r.rows[0]) return r.rows[0].username;
      const existing = (
        await db.pool.query(`SELECT username FROM users WHERE id = $1`, [
          userId,
        ])
      ).rows[0]?.username;
      if (existing) return existing;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw new Error("username_allocation_failed");
}

export function encodeCursor(c: { t: string; id: string }): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(c: string): { t: string; id: string } {
  try {
    const raw = Buffer.from(c, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.t === "string" &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
  } catch {}
  return {
    t: new Date(0).toISOString(),
    id: "00000000-0000-0000-0000-000000000000",
  };
}

function escapeLike(s: string) {
  return s.replace(/[%_\\]/g, "\\$&");
}

function normalizeTag(t: string) {
  return (t || "").trim().toLowerCase();
}

function toCard(row: {
  id: string;
  public_id: string;
  name: string;
  data: { task?: string; [key: string]: unknown };
  tags: string[];
  listed_at_raw: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}): CommunityPromptCard {
  const taskText =
    typeof row.data?.task === "string" ? row.data.task.trim() : "";
  const excerpt =
    taskText.length > 200 ? taskText.slice(0, 200) + "…" : taskText;

  return {
    publicId: row.public_id,
    title: row.name || "Untitled prompt",
    excerpt,
    tags: Array.isArray(row.tags) ? row.tags : [],
    listedAt: row.listed_at_raw,
    creator: {
      username: row.username,
      displayName: row.display_name || row.username,
      avatarUrl: row.avatar_url || null,
    },
  };
}

export async function listCommunityPrompts(o: {
  viewerId: string | null;
  creatorId?: string;
  q?: string;
  tags?: string[];
  sort?: "new" | "old";
  cursor?: string;
  limit?: number;
}): Promise<Page> {
  await db.ensureSchema();
  const limit = Math.min(o.limit ?? 24, 48);
  const dir = o.sort === "old" ? "ASC" : "DESC";
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const where: string[] = ["p.listed_in_community", "p.deleted_at IS NULL"];

  if (o.creatorId) {
    // profile view: creator-specific and viewer-aware
    where.push(
      `p.owner_id = ${add(o.creatorId)}::uuid`,
      visibleToViewerSql(add(o.viewerId)),
    );
  } else {
    // global feed: identical for everyone
    where.push(GLOBAL_FEED_SQL);
  }

  if (o.tags?.length) {
    const validTags = o.tags.map(normalizeTag).filter(Boolean);
    if (validTags.length > 0) {
      where.push(`p.tags @> ${add(validTags)}::text[]`);
    }
  }

  if (o.q?.trim()) {
    const q = o.q.trim().slice(0, 100);
    where.push(
      `(p.search @@ websearch_to_tsquery('simple', ${add(q)}) OR u.username LIKE ${add(
        escapeLike(q.toLowerCase()) + "%",
      )})`,
    );
  }

  if (o.cursor) {
    const c = decodeCursor(o.cursor);
    where.push(
      `(p.listed_at, p.id) ${dir === "ASC" ? ">" : "<"} (${add(c.t)}::timestamptz, ${add(c.id)}::uuid)`,
    );
  }

  const querySql = `SELECT p.id, p.public_id, p.name, p.data, p.tags, p.listed_at::text AS listed_at_raw,
           u.username, COALESCE(u.display_name, u.username) AS display_name, u.avatar_url
      FROM prompts p JOIN users u ON u.id = p.owner_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.listed_at ${dir}, p.id ${dir} LIMIT ${limit + 1}`;

  const { rows } = await db.pool.query(querySql, params);
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  return {
    items: pageRows.map(toCard),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: last.listed_at_raw, id: last.id })
        : null,
  };
}

export async function getPublicProfile(
  creatorId: string,
  viewerId: string | null,
): Promise<PublicProfile | null> {
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT u.id, u.username, COALESCE(u.display_name, u.username) AS "displayName",
            u.avatar_url AS "avatarUrl", u.banner_url AS "bannerUrl", u.bio,
            u.community_audience AS "communityAudience",
            (SELECT count(*)::int FROM follows WHERE followee_id = u.id) AS "followerCount",
            EXISTS (SELECT 1 FROM follows WHERE follower_id = $2::uuid AND followee_id = u.id) AS "following"
       FROM users u
      WHERE u.id = $1::uuid`,
    [creatorId, viewerId],
  );

  if (!rows[0]) return null;
  const r = rows[0];
  const isOwner = viewerId !== null && viewerId === creatorId;

  return {
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    bannerUrl: r.bannerUrl,
    bio: r.bio,
    followerCount: Number(r.followerCount) || 0,
    isOwner,
    following: Boolean(r.following),
    communityAudience: r.communityAudience || "public",
  };
}

export async function getFollowState(
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT 1 FROM follows WHERE follower_id = $1::uuid AND followee_id = $2::uuid`,
    [viewerId, targetId],
  );
  return rows.length > 0;
}

export async function followerCount(userId: string): Promise<number> {
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT count(*)::int AS count FROM follows WHERE followee_id = $1::uuid`,
    [userId],
  );
  return Number(rows[0]?.count) || 0;
}

export async function getUserByHandle(
  raw: string,
): Promise<{ id: string; username: string } | null> {
  const resolved = await resolveHandle(raw);
  if (!resolved) return null;
  return { id: resolved.userId, username: resolved.username };
}

export async function listCommunityTags(limit: number = 12): Promise<string[]> {
  try {
    await db.ensureSchema();
    const { rows } = await db.pool.query(
      `SELECT t.tag, count(*)::int AS count
       FROM prompts p JOIN users u ON u.id = p.owner_id, unnest(p.tags) AS t(tag)
       WHERE ${GLOBAL_FEED_SQL}
       GROUP BY t.tag
       ORDER BY count DESC, t.tag ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r: { tag: string }) => r.tag);
  } catch {
    return [];
  }
}
