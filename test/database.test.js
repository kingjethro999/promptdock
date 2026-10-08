const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getDatabaseConfig,
  normalizeDatabaseUrl,
  validatePrompt,
  importPrompts,
  listPrompts,
  normalizeImportedTimestamp,
  validateFeedback,
} = require("../src/database");

test("feedback accepts a trimmed report and optional reply email", () => {
  assert.deepEqual(
    validateFeedback({
      kind: "bug",
      message: "  Button stuck  ",
      contactEmail: " a@b.co ",
    }),
    { kind: "bug", message: "Button stuck", contactEmail: "a@b.co" },
  );
  assert.equal(
    validateFeedback({ kind: "idea", message: "Nice idea" }).contactEmail,
    null,
  );
  assert.throws(
    () => validateFeedback({ kind: "bad", message: "x" }),
    /feedback type/,
  );
  assert.throws(
    () => validateFeedback({ kind: "bug", message: "  " }),
    /report between/,
  );
  assert.throws(
    () => validateFeedback({ kind: "bug", message: "x".repeat(10001) }),
    /report between/,
  );
  assert.throws(
    () => validateFeedback({ kind: "bug", message: "x", contactEmail: "bad" }),
    /valid email/,
  );
});

test("Render external database URLs verify TLS without changing local URLs", () => {
  const external = normalizeDatabaseUrl(
    "postgresql://user:example@dpg-demo.oregon-postgres.render.com/promptdock",
  );
  assert.equal(new URL(external).searchParams.get("sslmode"), "verify-full");
  const requireMode = normalizeDatabaseUrl(
    "postgresql://user:example@dpg-demo.oregon-postgres.render.com/promptdock?sslmode=require",
  );
  assert.equal(new URL(requireMode).searchParams.get("sslmode"), "verify-full");
  const explicit =
    "postgresql://user:example@dpg-demo.oregon-postgres.render.com/promptdock?sslmode=verify-full";
  assert.equal(normalizeDatabaseUrl(explicit), explicit);
  const local = "postgresql://user:example@localhost:5434/promptdock";
  assert.equal(normalizeDatabaseUrl(local), local);
});

test("database configuration resolves DB_* and PG* environment variables", () => {
  const empty = getDatabaseConfig({});
  assert.equal(empty.configured, false);
  assert.equal(empty.options, null);

  const dbEnv = getDatabaseConfig({
    DB_HOST: "db.internal",
    DB_PORT: "5433",
    DB_USER: "app_user",
    DB_PASSWORD: "secret_db_password",
    DB_NAME: "promptdock_prod",
  });
  assert.equal(dbEnv.configured, true);
  assert.equal(dbEnv.options.host, "db.internal");
  assert.equal(dbEnv.options.port, 5433);
  assert.equal(dbEnv.options.user, "app_user");
  assert.equal(dbEnv.options.password, "secret_db_password");
  assert.equal(dbEnv.options.database, "promptdock_prod");

  const pgEnv = getDatabaseConfig({
    PGHOST: "postgres.internal",
    PGPORT: "5432",
    PGUSER: "pg_user",
    PGPASSWORD: "pg_password",
    PGDATABASE: "pg_db",
  });
  assert.equal(pgEnv.configured, true);
  assert.equal(pgEnv.options.host, "postgres.internal");
  assert.equal(pgEnv.options.port, 5432);
  assert.equal(pgEnv.options.user, "pg_user");
  assert.equal(pgEnv.options.password, "pg_password");
  assert.equal(pgEnv.options.database, "pg_db");

  const mixedEnv = getDatabaseConfig({
    DB_HOST: "override.host",
    PGHOST: "fallback.host",
    PGPORT: "5439",
  });
  assert.equal(mixedEnv.configured, true);
  assert.equal(mixedEnv.options.host, "override.host");
  assert.equal(mixedEnv.options.port, 5439);

  const urlEnv = getDatabaseConfig({
    DATABASE_URL: "postgresql://user:pass@main.host:5432/maindb",
    DB_HOST: "ignored.host",
  });
  assert.equal(urlEnv.configured, true);
  assert.equal(urlEnv.options.host, undefined);
  assert.match(urlEnv.options.connectionString, /main\.host/);
});

test("prompt tags are normalized and bounded", () => {
  const item = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    name: "Build a game",
    data: { task: "Build a game" },
    tags: ["Game", " game ", "Story"],
  };
  assert.deepEqual(validatePrompt(item).tags, ["game", "story"]);
  assert.throws(() => validatePrompt({ ...item, tags: ["bad/tag"] }), /tags/);
  assert.throws(
    () =>
      validatePrompt({
        ...item,
        tags: Array.from({ length: 9 }, (_, i) => `tag${i}`),
      }),
    /tags/,
  );
});

test("backup import validates its envelope and every prompt before writing", async () => {
  await assert.rejects(
    importPrompts("a".repeat(64), { version: 2, prompts: [{}] }),
    /Import 1–50/,
  );
  await assert.rejects(
    importPrompts("a".repeat(64), {
      version: 1,
      prompts: [{ name: "Missing task", data: {} }],
    }),
    /task/,
  );
});

test("library listing rejects unknown tag filters and sort orders", async () => {
  const key = "a".repeat(64);
  await assert.rejects(
    listPrompts(key, { tag: "bad/tag" }),
    /Invalid tag filter/,
  );
  await assert.rejects(
    listPrompts(key, { tag: "x".repeat(25) }),
    /Invalid tag filter/,
  );
  await assert.rejects(
    listPrompts(key, { sort: "updated_at; DROP TABLE prompts" }),
    /Invalid sort order/,
  );
});

test("imported timestamps keep real save dates and drop nonsense", () => {
  const saved = "2024-05-04T10:20:30.000Z";
  assert.equal(normalizeImportedTimestamp(saved), saved);
  assert.equal(normalizeImportedTimestamp(undefined), null);
  assert.equal(normalizeImportedTimestamp("not a date"), null);
  assert.equal(normalizeImportedTimestamp("1970-01-01T00:00:00.000Z"), null);
  assert.equal(normalizeImportedTimestamp("2200-01-01T00:00:00.000Z"), null);
});
