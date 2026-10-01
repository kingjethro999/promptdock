const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
