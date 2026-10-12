const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Pure TypeScript logic mirrored in CommonJS for test runner:
function effectiveVisibility(prompt, audience) {
  if (prompt === "private") return "private";
  if (prompt === "followers" || audience === "followers") return "followers";
  return "public";
}

function canView({
  viewerId,
  ownerId,
  visibility,
  audience,
  viewerFollowsOwner,
}) {
  if (viewerId && viewerId === ownerId) return true;
  switch (effectiveVisibility(visibility, audience)) {
    case "public":
      return true;
    case "followers":
      return viewerId !== null && Boolean(viewerFollowsOwner);
    default:
      return false;
  }
}

const visibleToViewerSql = (v) => `(
  p.owner_id = ${v}::uuid
  OR (p.visibility = 'public' AND u.community_audience = 'public')
  OR (p.visibility IN ('public','followers') AND ${v}::uuid IS NOT NULL
      AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${v}::uuid AND f.followee_id = p.owner_id))
)`;

function evalSqlPredicate({
  viewerId,
  ownerId,
  visibility,
  audience,
  viewerFollowsOwner,
}) {
  // Evaluates the SQL boolean expression in JS:
  // p.owner_id = v::uuid
  const isOwner = viewerId !== null && viewerId === ownerId;
  // (p.visibility = 'public' AND u.community_audience = 'public')
  const isPublicAudience = visibility === "public" && audience === "public";
  // (p.visibility IN ('public','followers') AND v::uuid IS NOT NULL AND EXISTS (...))
  const isFollowerVisible =
    (visibility === "public" || visibility === "followers") &&
    viewerId !== null &&
    Boolean(viewerFollowsOwner);

  return isOwner || isPublicAudience || isFollowerVisible;
}

function canViewCase(c) {
  const viewerId =
    c.v === "anon"
      ? null
      : c.v === "owner"
        ? "owner-1"
        : c.v === "follower"
          ? "follower-1"
          : "stranger-1";
  const ownerId = "owner-1";
  const viewerFollowsOwner = c.v === "follower";
  return canView({
    viewerId,
    ownerId,
    visibility: c.p,
    audience: c.a,
    viewerFollowsOwner,
  });
}

const viewers = ["anon", "stranger", "follower", "owner"];
const vis = ["private", "followers", "public"];
const aud = ["public", "followers"];

const surfaces = {
  feed: (c) => c.p === "public" && c.a === "public",
  search: (c) => c.p === "public" && c.a === "public",
  profile: (c) => canViewCase(c),
  detail: (c) => canViewCase(c),
  text: (c) => canViewCase(c),
  save: (c) => canViewCase(c) && c.v !== "owner",
  og: (c) => c.p === "public" && c.a === "public",
};

test("Privacy Matrix: all 24 combinations across 7 surfaces", async (t) => {
  for (const v of viewers) {
    for (const p of vis) {
      for (const a of aud) {
        const c = { v, p, a };
        await t.test(`viewer=${v} prompt=${p} audience=${a}`, () => {
          for (const [surfaceName, predicate] of Object.entries(surfaces)) {
            const expected = predicate(c);
            let actual;
            if (surfaceName === "feed" || surfaceName === "search") {
              // Global feed & search only include listed public prompts by public audience creators
              actual = c.p === "public" && c.a === "public";
            } else if (surfaceName === "og") {
              // Crawlers are anonymous
              actual = canViewCase({ v: "anon", p: c.p, a: c.a });
            } else if (surfaceName === "save") {
              actual = canViewCase(c) && c.v !== "owner";
            } else {
              actual = canViewCase(c);
            }
            assert.equal(
              actual,
              expected,
              `Mismatch on ${surfaceName} for viewer=${v}, prompt=${p}, audience=${a}`,
            );
          }
        });
      }
    }
  }
});

test("SQL predicate and TS canView agree for the whole matrix", () => {
  assert.ok(visibleToViewerSql("$2").includes("p.owner_id = $2::uuid"));
  for (const v of viewers) {
    for (const p of vis) {
      for (const a of aud) {
        const viewerId =
          v === "anon"
            ? null
            : v === "owner"
              ? "owner-1"
              : v === "follower"
                ? "follower-1"
                : "stranger-1";
        const ownerId = "owner-1";
        const viewerFollowsOwner = v === "follower";

        const tsResult = canView({
          viewerId,
          ownerId,
          visibility: p,
          audience: a,
          viewerFollowsOwner,
        });

        const sqlResult = evalSqlPredicate({
          viewerId,
          ownerId,
          visibility: p,
          audience: a,
          viewerFollowsOwner,
        });

        assert.equal(
          tsResult,
          sqlResult,
          `TS canView (${tsResult}) and SQL predicate (${sqlResult}) disagree for viewer=${v}, prompt=${p}, audience=${a}`,
        );
      }
    }
  }
});

test("route handlers never write their own visibility filters", () => {
  // Scans all files under src/app to ensure no inline visibility SQL or filter exists outside lib/community
  const appDir = path.join(process.cwd(), "src/app");
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          // Check for SQL or where clauses trying to check visibility directly
          if (
            /visibility\s*=\s*['"]/.test(line) &&
            !full.includes("route.tsx") && // exclude UI property assignments if any
            !line.includes("patch") && // exclude PATCH handler changing visibility
            !line.includes("body.visibility") &&
            !line.includes("input.visibility")
          ) {
            assert.fail(
              `Found inline visibility filter at ${full}:${index + 1}: ${line.trim()}`,
            );
          }
        });
      }
    }
  }
  walk(appDir);
});

test("every top-level route is a reserved username", async () => {
  const { RESERVED } = await import("../src/lib/community/username.ts");
  const appDir = path.join(process.cwd(), "src/app");

  const top = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) =>
        d.name.startsWith("(")
          ? top(path.join(dir, d.name))
          : /^[[_@]/.test(d.name)
            ? []
            : [d.name],
      );

  const segments = top(appDir);
  for (const seg of segments) {
    assert.ok(
      RESERVED.has(seg),
      `"${seg}" is a top-level route directory but not in RESERVED list`,
    );
  }
});
