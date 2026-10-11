const test = require("node:test");
const assert = require("node:assert/strict");

test("Community Legacy Public Links Suite", async (suite) => {
  const {
    effectiveVisibility,
    canView,
    visibleToViewerSql,
  } = await import("../src/lib/community/access.ts");

  await suite.test(
    "Legacy prompts with null visibility or null audience default to public",
    () => {
      // Pre-migration prompt: visibility is null or 'public'
      // Legacy author: community_audience is null or 'public'
      assert.equal(effectiveVisibility(null, null), "public");
      assert.equal(effectiveVisibility("public", null), "public");
      assert.equal(effectiveVisibility(null, "public"), "public");
      assert.equal(effectiveVisibility(undefined, undefined), "public");

      // Anonymous viewer can view public legacy prompt
      assert.equal(
        canView({
          viewerId: null,
          ownerId: "legacy-owner-key",
          visibility: null,
          audience: null,
          viewerFollowsOwner: false,
        }),
        true,
      );

      // Stranger can view public legacy prompt
      assert.equal(
        canView({
          viewerId: "stranger-user-id",
          ownerId: "legacy-owner-key",
          visibility: null,
          audience: null,
          viewerFollowsOwner: false,
        }),
        true,
      );

      // Owner can view legacy prompt
      assert.equal(
        canView({
          viewerId: "legacy-owner-key",
          ownerId: "legacy-owner-key",
          visibility: null,
          audience: null,
          viewerFollowsOwner: false,
        }),
        true,
      );
    },
  );

  await suite.test(
    "Legacy prompt with private visibility is restricted to owner",
    () => {
      // Anonymous cannot view private prompt
      assert.equal(
        canView({
          viewerId: null,
          ownerId: "legacy-owner-key",
          visibility: "private",
          audience: null,
          viewerFollowsOwner: false,
        }),
        false,
      );

      // Stranger cannot view private prompt
      assert.equal(
        canView({
          viewerId: "stranger-user-id",
          ownerId: "legacy-owner-key",
          visibility: "private",
          audience: null,
          viewerFollowsOwner: false,
        }),
        false,
      );

      // Owner CAN view private prompt
      assert.equal(
        canView({
          viewerId: "legacy-owner-key",
          ownerId: "legacy-owner-key",
          visibility: "private",
          audience: null,
          viewerFollowsOwner: false,
        }),
        true,
      );
    },
  );

  await suite.test("visibleToViewerSql handles NULL values with COALESCE", () => {
    const sql = visibleToViewerSql("$1");
    // Assert SQL contains COALESCE so legacy rows with null fields are not filtered out
    assert.ok(sql.includes("COALESCE(p.visibility, 'public')"));
    assert.ok(sql.includes("COALESCE(u.community_audience, 'public')"));
  });
});
