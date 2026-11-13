const test = require("node:test");
const assert = require("node:assert/strict");
const { createClientLoader } = require("./helpers/load-client-module.cjs");

const { VISIBILITY_STATES, visibilityState } = createClientLoader()(
  "src/lib/community/visibility-state.ts",
);

test("every stored visibility maps to one state people can read", () => {
  const id = (prompt) => visibilityState(prompt).id;
  assert.equal(id({ visibility: "private" }), "private");
  assert.equal(id({ visibility: "followers", publicId: "p" }), "followers");
  assert.equal(
    id({ visibility: "public", listedInCommunity: false, publicId: "p" }),
    "link",
  );
  assert.equal(
    id({ visibility: "public", listedInCommunity: true, publicId: "p" }),
    "community",
  );
  // Listing only applies to public prompts.
  assert.equal(
    id({ visibility: "private", listedInCommunity: true }),
    "private",
  );
  // Rows from before the visibility column existed.
  assert.equal(id({ publicId: "p" }), "link");
  assert.equal(id({}), "private");
});

test("each state round-trips through the fields the API stores", () => {
  for (const state of VISIBILITY_STATES) {
    assert.equal(
      visibilityState({
        visibility: state.visibility,
        listedInCommunity: state.listed,
        publicId: "p",
      }).id,
      state.id,
    );
    assert.ok(state.hint.length > 10);
    if (state.listed) assert.equal(state.visibility, "public");
  }
  assert.equal(new Set(VISIBILITY_STATES.map((s) => s.id)).size, 4);
});
