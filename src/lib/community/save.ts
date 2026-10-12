import { getPromptForViewer, getPromptByIdForViewer } from "./queries.ts";
import type { PublicCreator } from "./types";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const db = req("../../database");

export class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message || String(status));
    this.status = status;
  }
}

export async function savePrompt(
  viewerId: string,
  publicId: string,
  origin: "save" | "remix",
): Promise<{ id: string; alreadySaved: boolean }> {
  await db.ensureSchema();

  const src = await getPromptForViewer(publicId, viewerId);
  if (!src) throw new HttpError(404, "not_found");
  if (src.ownerId === viewerId) throw new HttpError(409, "own_prompt");

  const ownerKey = db.accountKey(viewerId);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    if (origin === "save") {
      const dup = await client.query(
        `SELECT id FROM prompts WHERE owner_id = $1::uuid AND source_prompt_id = $2::uuid AND origin = 'save' LIMIT 1`,
        [viewerId, src.id],
      );
      if (dup.rows[0]) {
        await client.query("COMMIT");
        return { id: dup.rows[0].id, alreadySaved: true };
      }
    }

    try {
      const copy = await client.query(
        `INSERT INTO prompts (
           id, owner_key, owner_id, name, data, tags, idea,
           visibility, listed_in_community, source_prompt_id, origin
         )
         VALUES (
           gen_random_uuid(), $1, $2::uuid, $3, $4, $5, '',
           'private', false, $6::uuid, $7
         )
         RETURNING id`,
        [ownerKey, viewerId, src.name, src.data, src.tags, src.id, origin],
      );

      await client.query("COMMIT");
      return { id: copy.rows[0].id, alreadySaved: false };
    } catch (insertErr) {
      if (
        (insertErr as { code?: string }).code === "23505" &&
        origin === "save"
      ) {
        // Unique conflict on prompts_one_save_per_source
        const dup = await client.query(
          `SELECT id FROM prompts WHERE owner_id = $1::uuid AND source_prompt_id = $2::uuid AND origin = 'save' LIMIT 1`,
          [viewerId, src.id],
        );
        await client.query("COMMIT");
        if (dup.rows[0]) {
          return { id: dup.rows[0].id, alreadySaved: true };
        }
      }
      throw insertErr;
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export type AttributionResult =
  | {
      title: string;
      publicId: string;
      creator: PublicCreator;
      unavailable?: false;
    }
  | { unavailable: true }
  | null;

export async function resolveAttribution(
  viewerId: string | null,
  p: { sourcePromptId: string | null },
): Promise<AttributionResult> {
  if (!p.sourcePromptId) return null;
  const src = await getPromptByIdForViewer(p.sourcePromptId, viewerId);
  if (!src) {
    return { unavailable: true };
  }
  return {
    title: src.name,
    publicId: src.publicId,
    creator: {
      username: src.username,
      displayName: src.displayName,
      avatarUrl: src.avatarUrl,
    },
    unavailable: false,
  };
}
