const test = require("node:test");
const assert = require("node:assert/strict");
const { diffLines, diffPrompt, compact, titleCase } = require("../src/diff");

test("line diffs mark shared lines and swaps between two versions", () => {
  assert.deepEqual(diffLines("one\ntwo\nthree", "one\n3\nthree"), [
    { type: "same", text: "one" },
    { type: "del", text: "two" },
    { type: "add", text: "3" },
    { type: "same", text: "three" },
  ]);
  assert.deepEqual(diffLines("", "first"), [{ type: "add", text: "first" }]);
  assert.deepEqual(diffLines("only", "only"), [{ type: "same", text: "only" }]);
});

test("prompt diffs report only the fields a restore would change", () => {
  const current = {
    name: "Game writer",
    idea: "Write a quest",
    analysis: "Keep it short",
    data: { task: "Write a quest", tone: "Clear and concise", depth: "Quick" },
    tags: ["game", "draft"],
  };
  const revision = {
    name: "Game writer",
    idea: "Write a quest",
    analysis: "Keep it short",
    data: { task: "Write a quest", tone: "Friendly", depth: "Quick" },
    tags: ["game", "story"],
  };
  const changes = diffPrompt(current, revision);
  assert.deepEqual(
    changes.map((change) => change.label),
    ["Tone", "Tags"],
  );
  assert.deepEqual(changes[0].ops, [
    { type: "del", text: "Clear and concise" },
    { type: "add", text: "Friendly" },
  ]);
  assert.deepEqual(changes[1], {
    label: "Tags",
    type: "tags",
    added: ["story"],
    removed: ["draft"],
  });
  assert.deepEqual(diffPrompt(current, { ...revision, tags: current.tags }), [
    changes[0],
  ]);
  assert.deepEqual(diffPrompt(current, current), []);
  assert.deepEqual(diffPrompt(undefined, undefined), []);
});

test("long diffs drop unchanged context lines", () => {
  const ops = Array.from({ length: 60 }, (_, index) => ({
    type: "same",
    text: `line ${index}`,
  }));
  ops[30] = { type: "del", text: "gone" };
  ops[31] = { type: "add", text: "new" };
  const short = compact(ops, 10);
  assert.equal(short.truncated, false);
  assert.deepEqual(short.ops, [
    { type: "del", text: "gone" },
    { type: "add", text: "new" },
  ]);
  const big = Array.from({ length: 500 }, (_, index) => ({
    type: index % 2 ? "del" : "add",
    text: `line ${index}`,
  }));
  const cut = compact(big, 10);
  assert.equal(cut.truncated, true);
  assert.equal(cut.ops.length, 10);
  assert.deepEqual(compact([{ type: "same", text: "x" }]).ops, [
    { type: "same", text: "x" },
  ]);
});

test("field labels are readable for snake case keys", () => {
  assert.equal(titleCase("output_format"), "Output format");
  assert.equal(titleCase("task"), "Task");
});
