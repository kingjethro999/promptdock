import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createRequire } from "node:module";
import { HttpError } from "./save.ts";
import { scanPrompt, type Finding } from "./sensitive.ts";
import type { Visibility } from "./access.ts";

const req = createRequire(import.meta.url);
const db = req("../../database");

export type VisibilityResult = {
  id: string;
  publicId: string;
  visibility: Visibility;
  listedInCommunity: boolean;
  listedAt: string | null;
  blocked?: Finding[];
  needsAck?: Finding[];
};

export async function setPromptVisibility(
  viewer: { id: string; username?: string | null },
  id: string,
  options: {
    visibility?: Visibility;
    listed?: boolean;
    acknowledgeWarn?: boolean;
  },
): Promise<VisibilityResult> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new HttpError(404, "not_found");
  }

  await db.ensureSchema();
  const ownerKey = db.accountKey(viewer.id);

  // Fetch current prompt to check ownership and run safety scan if publishing
  const existingRes = await db.pool.query(
    `SELECT id, name, tags, data, visibility, public_id AS "publicId"
     FROM prompts
     WHERE id = $1::uuid AND (owner_id = $2::uuid OR owner_key = $3)
       AND deleted_at IS NULL`,
    [id, viewer.id, ownerKey],
  );

  if (existingRes.rowCount === 0) {
    throw new HttpError(404, "not_found");
  }

  const existing = existingRes.rows[0];

  const validVisibilities: Visibility[] = ["private", "followers", "public"];
  const visibility: Visibility = validVisibilities.includes(
    options.visibility as Visibility,
  )
    ? (options.visibility as Visibility)
    : "private";

  const listed = visibility === "private" ? false : Boolean(options.listed);

  // If publishing (non-private), run sensitive scan
  if (visibility !== "private") {
    const findings = scanPrompt({
      name: existing.name,
      tags: existing.tags,
      data: existing.data,
    });

    const blocked = findings.filter((f) => f.severity === "block");
    if (blocked.length > 0) {
      throw Object.assign(new HttpError(422, "blocked"), { findings: blocked });
    }

    const warns = findings.filter((f) => f.severity === "warn");
    if (warns.length > 0 && !options.acknowledgeWarn) {
      throw Object.assign(new HttpError(422, "needs_ack"), { findings: warns });
    }
  }

  const newPublicId = randomUUID();

  const result = await db.pool.query(
    `UPDATE prompts SET
       visibility = $2,
       listed_in_community = $3::boolean,
       listed_at = CASE WHEN $3::boolean AND NOT listed_in_community THEN now()
                        WHEN NOT $3::boolean THEN NULL ELSE listed_at END,
       public_id = COALESCE(public_id, $4::uuid),
       owner_id = $5::uuid
     WHERE id = $1::uuid AND (owner_id = $5::uuid OR owner_key = $6)
     RETURNING id, public_id AS "publicId", visibility, listed_in_community AS "listedInCommunity", listed_at AS "listedAt"`,
    [id, visibility, listed, newPublicId, viewer.id, ownerKey],
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, "not_found");
  }

  const row = result.rows[0];

  try {
    revalidatePath("/community");
    if (viewer.username) {
      revalidatePath(`/${viewer.username}`);
    }
    if (row.publicId) {
      revalidatePath(`/p/${row.publicId}`);
    }
  } catch {}

  return {
    id: row.id,
    publicId: row.publicId,
    visibility: row.visibility,
    listedInCommunity: row.listedInCommunity,
    listedAt: row.listedAt,
  };
}
