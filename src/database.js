const { createHash } = require("node:crypto");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const schema = require("./schema");

function normalizeDatabaseUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.hostname.endsWith(".render.com") &&
    (!url.searchParams.has("sslmode") ||
      url.searchParams.get("sslmode") === "require")
  )
    url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

const configured = Boolean(process.env.DATABASE_URL || process.env.PGHOST);
const pool = configured
  ? new Pool({
      connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
      host: process.env.DATABASE_URL ? undefined : process.env.PGHOST,
      port: process.env.DATABASE_URL
        ? undefined
        : Number(process.env.PGPORT) || 5432,
      user: process.env.DATABASE_URL ? undefined : process.env.PGUSER,
      password: process.env.DATABASE_URL ? undefined : process.env.PGPASSWORD,
      database: process.env.DATABASE_URL ? undefined : process.env.PGDATABASE,
      max: process.env.VERCEL ? 1 : 5,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
    })
  : null;
let schemaReady;

async function ensureSchema() {
  if (!pool) return;
  if (!schemaReady)
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(4736291)");
        for (const statement of schema) await client.query(statement);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  await schemaReady;
}

function accountKey(userId) {
  return createHash("sha256").update(`account:${userId}`).digest("hex");
}
function legacyKey(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("A valid legacy workspace token is required.");
  return createHash("sha256").update(token).digest("hex");
}

async function importLegacy(userId, token) {
  const source = legacyKey(token);
  const target = accountKey(userId);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO prompts (owner_key, id, name, data, idea, analysis, tags, updated_at)
      SELECT $1, id, name, data, idea, analysis, tags, updated_at FROM prompts WHERE owner_key = $2
      ON CONFLICT (owner_key, id) DO NOTHING`,
      [target, source],
    );
    await client.query("DELETE FROM prompts WHERE owner_key = $1", [source]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function validatePrompt(item) {
  if (
    !item ||
    typeof item !== "object" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      item.id || "",
    )
  )
    throw new Error("Invalid prompt ID.");
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name || name.length > 120)
    throw new Error("Prompt name must be 1–120 characters.");
  if (
    !item.data ||
    typeof item.data !== "object" ||
    Array.isArray(item.data) ||
    typeof item.data.task !== "string" ||
    !item.data.task.trim()
  )
    throw new Error("A prompt task is required.");
  if (JSON.stringify(item.data).length > 400000)
    throw new Error("Prompt is too long.");
  const idea = typeof item.idea === "string" ? item.idea.slice(0, 100000) : "";
  const analysis =
    item.analysis &&
    typeof item.analysis === "object" &&
    !Array.isArray(item.analysis)
      ? item.analysis
      : null;
  if (analysis && JSON.stringify(analysis).length > 100000)
    throw new Error("Analysis is too long.");
  if (item.tags != null && !Array.isArray(item.tags))
    throw new Error("Tags must be a list.");
  const tags = [
    ...new Set(
      (item.tags || []).map((tag) =>
        typeof tag === "string" ? tag.trim().toLowerCase() : "",
      ),
    ),
  ];
  if (
    tags.length > 8 ||
    tags.some(
      (tag) =>
        !tag || tag.length > 24 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag),
    )
  )
    throw new Error("Use up to 8 tags, each 1–24 letters or numbers.");
  return { id: item.id, name, data: item.data, idea, analysis, tags };
}

const promptSorts = { updated: "updated_at DESC", name: "name ASC" };

function normalizeTagFilter(value) {
  const tag = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!tag) return "";
  if (tag.length > 24 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag))
    throw new Error("Invalid tag filter.");
  return tag;
}

async function listPrompts(key, options = {}) {
  const q = String(options.q || "").trim();
  if (q.length > 100) throw new Error("Search is too long.");
  const offset = Number(options.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    throw new Error("Invalid offset.");
  const tag = normalizeTagFilter(options.tag);
  const sort = options.sort || "updated";
  if (!promptSorts[sort]) throw new Error("Invalid sort order.");
  await ensureSchema();
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = `owner_key = $1 AND ($2 = '' OR name ILIKE $3 ESCAPE '\\' OR idea ILIKE $3 ESCAPE '\\' OR data->>'task' ILIKE $3 ESCAPE '\\' OR EXISTS (SELECT 1 FROM unnest(tags) tag WHERE tag ILIKE $3 ESCAPE '\\')) AND ($4 = '' OR tags @> ARRAY[$4]::text[])`;
  const params = [key, q, pattern, tag];
  const [result, count] = await Promise.all([
    pool.query(
      `SELECT id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt" FROM prompts WHERE ${where} ORDER BY ${promptSorts[sort]} LIMIT 100 OFFSET $5`,
      [...params, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM prompts WHERE ${where}`,
      params,
    ),
  ]);
  return { prompts: result.rows, total: count.rows[0].total };
}

async function listTags(key) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT t.tag, count(*)::int AS count FROM prompts, unnest(prompts.tags) AS t(tag)
    WHERE prompts.owner_key = $1 GROUP BY t.tag ORDER BY count DESC, t.tag ASC`,
    [key],
  );
  return result.rows;
}

async function exportPrompts(key) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, name, data, idea, analysis, tags, public_id AS "publicId",
      forked_from AS "forkedFrom", updated_at AS "updatedAt"
    FROM prompts WHERE owner_key = $1 ORDER BY updated_at DESC, id ASC`,
    [key],
  );
  return result.rows;
}

async function putPrompt(key, input) {
  const item = validatePrompt(input);
  await ensureSchema();
  const client = await pool.connect();
  const params = [
    key,
    item.id,
    item.name,
    item.data,
    item.idea,
    item.analysis,
    item.tags,
  ];
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO prompts (owner_key, id, name, data, idea, analysis, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (owner_key, id) DO NOTHING`,
      params,
    );
    if (!inserted.rowCount) {
      const previous = await client.query(
        `SELECT name, data, idea, analysis, tags,
        (name IS DISTINCT FROM $3::text OR data IS DISTINCT FROM $4::jsonb OR idea IS DISTINCT FROM $5::text
          OR analysis IS DISTINCT FROM $6::jsonb OR tags IS DISTINCT FROM $7::text[]) AS changed
        FROM prompts WHERE owner_key = $1 AND id = $2 FOR UPDATE`,
        params,
      );
      const old = previous.rows[0];
      if (old.changed) {
        await client.query(
          `INSERT INTO prompt_revisions (owner_key, prompt_id, name, data, idea, analysis, tags)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [key, item.id, old.name, old.data, old.idea, old.analysis, old.tags],
        );
        await client.query(
          `DELETE FROM prompt_revisions WHERE owner_key = $1 AND prompt_id = $2 AND revision_id NOT IN
          (SELECT revision_id FROM prompt_revisions WHERE owner_key = $1 AND prompt_id = $2 ORDER BY revision_id DESC LIMIT 10)`,
          [key, item.id],
        );
        await client.query(
          `UPDATE prompts SET name = $3, data = $4, idea = $5, analysis = $6, tags = $7, updated_at = now()
          WHERE owner_key = $1 AND id = $2`,
          params,
        );
      }
    }
    const result = await client.query(
      `SELECT id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"
      FROM prompts WHERE owner_key = $1 AND id = $2`,
      [key, item.id],
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function listRevisions(key, id) {
  if (!validUuid(id)) throw new Error("Invalid prompt ID.");
  await ensureSchema();
  const [prompt, revisions] = await Promise.all([
    pool.query("SELECT 1 FROM prompts WHERE owner_key = $1 AND id = $2", [
      key,
      id,
    ]),
    pool.query(
      `SELECT revision_id AS "revisionId", name, data, idea, analysis, tags, created_at AS "createdAt"
      FROM prompt_revisions WHERE owner_key = $1 AND prompt_id = $2 ORDER BY revision_id DESC LIMIT 10`,
      [key, id],
    ),
  ]);
  return prompt.rowCount ? revisions.rows : null;
}

async function restoreRevision(key, id, revisionId) {
  if (!validUuid(id) || !/^\d+$/.test(String(revisionId)))
    throw new Error("Invalid revision ID.");
  await ensureSchema();
  const result = await pool.query(
    `SELECT name, data, idea, analysis, tags FROM prompt_revisions
    WHERE owner_key = $1 AND prompt_id = $2 AND revision_id = $3`,
    [key, id, revisionId],
  );
  if (!result.rowCount) return null;
  return putPrompt(key, { id, ...result.rows[0] });
}

async function duplicatePrompt(key, id) {
  if (!validUuid(id)) throw new Error("Invalid prompt ID.");
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO prompts (owner_key, id, name, data, idea, analysis, tags)
    SELECT owner_key, $3, left(name, 115) || ' copy', data, idea, analysis, tags
    FROM prompts WHERE owner_key = $1 AND id = $2
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
    [key, id, randomUUID()],
  );
  return result.rows[0] || null;
}

function normalizeImportedTimestamp(value) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const floor = Date.parse("2000-01-01");
  const ceiling = Date.now() + 86400000;
  return time < floor || time > ceiling ? null : new Date(time).toISOString();
}

async function importPrompts(key, input) {
  if (
    !input ||
    input.version !== 1 ||
    !Array.isArray(input.prompts) ||
    !input.prompts.length ||
    input.prompts.length > 50
  )
    throw new Error("Import 1–50 prompts at a time from a PromptDock backup.");
  const sources = input.prompts.map((prompt) => {
    const id = validUuid(prompt.id) ? prompt.id : randomUUID();
    return {
      id,
      item: validatePrompt({ ...prompt, id }),
      updatedAt: normalizeImportedTimestamp(prompt.updatedAt),
      forkedFrom: validUuid(prompt.forkedFrom) ? prompt.forkedFrom : null,
    };
  });
  await ensureSchema();
  const wantedIds = [...new Set(sources.map((source) => source.id))];
  const taken = new Set();
  if (wantedIds.length) {
    const result = await pool.query(
      "SELECT id FROM prompts WHERE owner_key = $1 AND id = ANY($2::uuid[])",
      [key, wantedIds],
    );
    for (const row of result.rows) taken.add(row.id);
  }
  const wantedForks = [
    ...new Set(sources.map((source) => source.forkedFrom).filter((id) => id)),
  ];
  const blockedForks = new Set();
  if (wantedForks.length) {
    const result = await pool.query(
      "SELECT forked_from FROM prompts WHERE owner_key = $1 AND forked_from = ANY($2::uuid[])",
      [key, wantedForks],
    );
    for (const row of result.rows) blockedForks.add(row.forkedFrom);
  }
  const values = [];
  const rows = sources.map((source, index) => {
    const id = taken.has(source.id) ? randomUUID() : source.id;
    taken.add(id);
    const forkedFrom =
      source.forkedFrom && !blockedForks.has(source.forkedFrom)
        ? source.forkedFrom
        : null;
    if (forkedFrom) blockedForks.add(forkedFrom);
    const { item } = source;
    const start = index * 9;
    values.push(
      key,
      id,
      item.name,
      item.data,
      item.idea,
      item.analysis,
      item.tags,
      source.updatedAt || new Date().toISOString(),
      forkedFrom,
    );
    return `(${Array.from({ length: 9 }, (_, n) => `$${start + n + 1}`).join(", ")})`;
  });
  const result = await pool.query(
    `INSERT INTO prompts (owner_key, id, name, data, idea, analysis, tags, updated_at, forked_from)
    VALUES ${rows.join(", ")} RETURNING id`,
    values,
  );
  return result.rowCount;
}

async function deletePrompt(key, id) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new Error("Invalid prompt ID.");
  await ensureSchema();
  await pool.query("DELETE FROM prompts WHERE owner_key = $1 AND id = $2", [
    key,
    id,
  ]);
}

function validUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

async function setPromptPublic(key, id, published, username = null) {
  if (!validUuid(id) || typeof published !== "boolean")
    throw new Error("Invalid sharing request.");
  await ensureSchema();
  const result = await pool.query(
    `UPDATE prompts SET public_id = CASE WHEN $3 THEN COALESCE(public_id, $4::uuid) ELSE NULL END,
    published_at = CASE WHEN $3 THEN COALESCE(published_at, now()) ELSE NULL END,
    owner_username = CASE WHEN $3 THEN $5 ELSE owner_username END
    WHERE owner_key = $1 AND id = $2
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
    [key, id, published, randomUUID(), username],
  );
  return result.rows[0] || null;
}

async function setOwnerUsername(userId, username) {
  if (!pool) return 0;
  await ensureSchema();
  const result = await pool.query(
    "UPDATE prompts SET owner_username = $1 WHERE owner_key = $2",
    [username, accountKey(userId)],
  );
  return result.rowCount;
}

async function getPublicPrompt(publicId) {
  if (!validUuid(publicId)) return null;
  await ensureSchema();
  const result = await pool.query(
    `SELECT public_id AS "publicId", name, data, owner_username AS "ownerUsername", updated_at AS "updatedAt"
    FROM prompts WHERE public_id = $1`,
    [publicId],
  );
  return result.rows[0] || null;
}

async function forkPublicPrompt(key, publicId) {
  if (!validUuid(publicId)) return null;
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO prompts (owner_key, id, name, data, tags, forked_from)
    SELECT $1, $2, name, data, tags, public_id FROM prompts WHERE public_id = $3
    ON CONFLICT (owner_key, forked_from) WHERE forked_from IS NOT NULL DO UPDATE SET name = prompts.name
    RETURNING id, name, data, idea, analysis, tags, public_id AS "publicId", forked_from AS "forkedFrom", updated_at AS "updatedAt"`,
    [key, randomUUID(), publicId],
  );
  return result.rows[0] || null;
}

function validateFeedback(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Enter a report before sending.");
  const kind = input.kind;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const contactEmail =
    typeof input.contactEmail === "string" ? input.contactEmail.trim() : "";
  if (!["bug", "idea", "other"].includes(kind))
    throw new Error("Choose a feedback type.");
  if (!message || message.length > 10000)
    throw new Error("Write a report between 1 and 10,000 characters.");
  if (
    contactEmail &&
    (contactEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  )
    throw new Error("Enter a valid email address or leave it blank.");
  return { kind, message, contactEmail: contactEmail || null };
}

async function createFeedback(input, userId = null) {
  const { kind, message, contactEmail } = validateFeedback(input);
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO feedback_reports (user_id, kind, message, contact_email)
    VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, kind, message, contactEmail],
  );
  return result.rows[0].id;
}

async function listReadUpdates(userId) {
  await ensureSchema();
  const result = await pool.query(
    "SELECT update_id FROM user_update_reads WHERE user_id = $1",
    [userId],
  );
  return result.rows.map((row) => row.update_id);
}

async function markUpdateRead(userId, updateId) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO user_update_reads (user_id, update_id) VALUES ($1, $2)
     ON CONFLICT (user_id, update_id) DO UPDATE SET read_at = now()`,
    [userId, updateId],
  );
}

async function markAllUpdatesRead(userId, updateIds) {
  await ensureSchema();
  if (!updateIds.length) return;
  await pool.query(
    `INSERT INTO user_update_reads (user_id, update_id)
     SELECT $1, value FROM jsonb_array_elements_text($2::jsonb)
     ON CONFLICT (user_id, update_id) DO UPDATE SET read_at = now()`,
    [userId, JSON.stringify(updateIds)],
  );
}

module.exports = {
  configured,
  pool,
  normalizeDatabaseUrl,
  ensureSchema,
  accountKey,
  legacyKey,
  importLegacy,
  validatePrompt,
  listPrompts,
  listTags,
  exportPrompts,
  putPrompt,
  listRevisions,
  restoreRevision,
  duplicatePrompt,
  importPrompts,
  normalizeImportedTimestamp,
  deletePrompt,
  setPromptPublic,
  setOwnerUsername,
  getPublicPrompt,
  forkPublicPrompt,
  validateFeedback,
  createFeedback,
  listReadUpdates,
  markUpdateRead,
  markAllUpdatesRead,
};
