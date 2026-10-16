import { createRequire } from "node:module";
import { visibleToViewerSql } from "./access.ts";
import { HttpError } from "./save.ts";

const req = createRequire(import.meta.url);
const db = req("../../database");

export const collectionVisibleSql = (v: string) => `(
  c.owner_id = ${v}::uuid
  OR (c.visibility = 'public' AND COALESCE(u.community_audience, 'public') = 'public')
  OR (c.visibility IN ('public','followers') AND ${v}::uuid IS NOT NULL
      AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${v}::uuid AND f.followee_id = c.owner_id))
)`;

export type TxClient = {
  query: <R = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: R[]; rowCount: number | null }>;
};

export async function withTx<T>(
  fn: (client: TxClient) => Promise<T>,
): Promise<T> {
  await db.ensureSchema();
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json(
      { error: err.message },
      { status: err.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("Collections error:", err);
  return Response.json({ error: "internal_error" }, { status: 500 });
}

export type CollectionViewerRecord = {
  id: string;
  publicId: string;
  name: string;
  description: string | null;
  visibility: "private" | "followers" | "public";
  listed: boolean;
  updatedAt: string;
  ownerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOwner: boolean;
};

export async function getCollectionForViewer(
  publicId: string,
  viewerId: string | null,
): Promise<CollectionViewerRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return null;
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT c.id, c.public_id AS "publicId", c.name, c.description, c.visibility,
            c.listed_in_community AS "listed", c.updated_at AS "updatedAt", c.owner_id AS "ownerId",
            u.username, COALESCE(u.display_name, u.username) AS "displayName", u.avatar_url AS "avatarUrl",
            (c.owner_id = $2::uuid) AS "isOwner"
       FROM collections c
       JOIN users u ON u.id = c.owner_id
      WHERE c.public_id = $1::uuid AND ${collectionVisibleSql("$2")}`,
    [publicId, viewerId],
  );
  return rows[0] ?? null;
}

export type VisitorCollectionItem = {
  id: string;
  publicId: string;
  title: string;
  data: unknown;
  tags: string[];
  username: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number;
};

export async function listItemsForVisitor(
  collectionId: string,
  viewerId: string | null,
  limit = 200,
): Promise<VisitorCollectionItem[]> {
  await db.ensureSchema();
  const { rows } = await db.pool.query(
    `SELECT p.id, p.public_id AS "publicId", p.name AS title, p.data, p.tags,
            u.username, COALESCE(u.display_name, u.username) AS "displayName", u.avatar_url AS "avatarUrl",
            row_number() OVER (ORDER BY ci.position, ci.added_at, p.id)::int AS rank
       FROM collection_items ci
       JOIN prompts p ON p.id = ci.prompt_id
       JOIN users u ON u.id = p.owner_id
      WHERE ci.collection_id = $1::uuid AND p.deleted_at IS NULL AND p.public_id IS NOT NULL
        AND ${visibleToViewerSql("$2")}
      ORDER BY ci.position, ci.added_at, p.id LIMIT $3`,
    [collectionId, viewerId, limit],
  );
  return rows;
}

export type SeriesContext = {
  collection: { id: string; publicId: string; name: string };
  rank: number;
  total: number;
  prevPublicId: string | null;
  nextPublicId: string | null;
};

export async function getSeriesContext(
  promptPublicId: string,
  collectionPublicId: string,
  viewerId: string | null,
): Promise<SeriesContext | null> {
  if (
    !/^[0-9a-f-]{36}$/i.test(promptPublicId) ||
    !/^[0-9a-f-]{36}$/i.test(collectionPublicId)
  )
    return null;

  const col = await getCollectionForViewer(collectionPublicId, viewerId);
  if (!col) return null;

  const { rows } = await db.pool.query(
    `WITH visible_items AS (
       SELECT p.public_id AS "publicId", p.name AS title,
              ci.position, ci.added_at, p.id,
              row_number() OVER (ORDER BY ci.position, ci.added_at, p.id)::int AS rank,
              count(*) OVER ()::int AS total,
              lag(p.public_id) OVER (ORDER BY ci.position, ci.added_at, p.id) AS "prevPublicId",
              lead(p.public_id) OVER (ORDER BY ci.position, ci.added_at, p.id) AS "nextPublicId"
         FROM collection_items ci
         JOIN prompts p ON p.id = ci.prompt_id
         JOIN users u ON u.id = p.owner_id
        WHERE ci.collection_id = $1::uuid AND p.deleted_at IS NULL AND p.public_id IS NOT NULL
          AND ${visibleToViewerSql("$2")}
     )
     SELECT * FROM visible_items WHERE "publicId" = $3::uuid`,
    [col.id, viewerId, promptPublicId],
  );

  if (!rows[0]) return null;
  return {
    collection: { id: col.id, publicId: col.publicId, name: col.name },
    rank: rows[0].rank,
    total: rows[0].total,
    prevPublicId: rows[0].prevPublicId,
    nextPublicId: rows[0].nextPublicId,
  };
}

export type OwnerCollectionItem = {
  id: string;
  publicId: string | null;
  title: string;
  data: unknown;
  tags: string[];
  position: number;
  addedAt: string;
  visibility: "private" | "followers" | "public";
  listedInCommunity: boolean;
  state: "visible" | "private" | "followers" | "unlisted";
};

export async function listItemsForOwner(
  collectionId: string,
  ownerId: string,
): Promise<OwnerCollectionItem[]> {
  await db.ensureSchema();
  type Row = Omit<OwnerCollectionItem, "state">;
  const { rows } = (await db.pool.query(
    `SELECT p.id, p.public_id AS "publicId", p.name AS title, p.data, p.tags,
            ci.position, ci.added_at AS "addedAt",
            COALESCE(p.visibility, 'private') AS visibility,
            COALESCE(p.listed_in_community, false) AS "listedInCommunity"
       FROM collection_items ci
       JOIN collections c ON c.id = ci.collection_id
       JOIN prompts p ON p.id = ci.prompt_id
      WHERE ci.collection_id = $1::uuid AND c.owner_id = $2::uuid AND p.deleted_at IS NULL
      ORDER BY ci.position, ci.added_at, p.id`,
    [collectionId, ownerId],
  )) as { rows: Row[] };

  return rows.map((r: Row) => {
    let state: "visible" | "private" | "followers" | "unlisted" = "visible";
    if (r.visibility === "private") state = "private";
    else if (r.visibility === "followers") state = "followers";
    else if (!r.listedInCommunity) state = "unlisted";
    return { ...r, state };
  });
}

export type ProfileCollectionCard = {
  id: string;
  publicId: string;
  name: string;
  description: string | null;
  count: number;
  sampleTitles: string[];
  updatedAt: string;
};

export async function listProfileCollections(
  creatorId: string,
  viewerId: string | null,
): Promise<ProfileCollectionCard[]> {
  interface ProfileRow {
    id: string;
    publicId: string;
    name: string;
    description: string | null;
    updatedAt: string;
    visibleCount: number;
    sampleTitles: string[] | null;
  }

  await db.ensureSchema();
  const { rows } = (await db.pool.query(
    `SELECT c.id, c.public_id AS "publicId", c.name, c.description, c.updated_at AS "updatedAt",
            (
              SELECT count(*)::int
                FROM collection_items ci
                JOIN prompts p ON p.id = ci.prompt_id
               WHERE ci.collection_id = c.id
                 AND p.deleted_at IS NULL AND p.public_id IS NOT NULL
                 AND ${visibleToViewerSql("$2")}
            ) AS "visibleCount",
            (
              SELECT json_agg(title) FROM (
                SELECT p.name AS title
                  FROM collection_items ci
                  JOIN prompts p ON p.id = ci.prompt_id
                 WHERE ci.collection_id = c.id
                   AND p.deleted_at IS NULL AND p.public_id IS NOT NULL
                   AND ${visibleToViewerSql("$2")}
                 ORDER BY ci.position, ci.added_at, p.id
                 LIMIT 3
              ) s
            ) AS "sampleTitles"
       FROM collections c
       JOIN users u ON u.id = c.owner_id
      WHERE c.owner_id = $1::uuid
        AND c.listed_in_community = true
        AND c.public_id IS NOT NULL
        AND ${collectionVisibleSql("$2")}
      ORDER BY c.updated_at DESC`,
    [creatorId, viewerId],
  )) as { rows: ProfileRow[] };

  return rows
    .filter((r: ProfileRow) => r.visibleCount > 0)
    .map((r: ProfileRow) => ({
      id: r.id,
      publicId: r.publicId,
      name: r.name,
      description: r.description,
      count: r.visibleCount,
      sampleTitles: r.sampleTitles || [],
      updatedAt: r.updatedAt,
    }));
}
