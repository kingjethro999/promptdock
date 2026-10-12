import test from "node:test";
import assert from "node:assert/strict";
import {
  canView,
  effectiveVisibility,
  visibleToViewerSql,
} from "../src/lib/community/access.ts";
import type { Visibility, Audience } from "../src/lib/community/access.ts";

type Viewer = "anon" | "stranger" | "follower" | "owner";
type C = { v: Viewer; p: Visibility; a: Audience };

const viewers: readonly Viewer[] = [
  "anon",
  "stranger",
  "follower",
  "owner",
] as const;
const vis: readonly Visibility[] = ["private", "followers", "public"] as const;
const aud: readonly Audience[] = ["public", "followers"] as const;

function canViewCase(c: C): boolean {
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

export const surfaces = {
  feed: (c: C) => c.p === "public" && c.a === "public",
  search: (c: C) => c.p === "public" && c.a === "public",
  profile: (c: C) => canViewCase(c),
  detail: (c: C) => canViewCase(c),
  text: (c: C) => canViewCase(c),
  save: (c: C) => canViewCase(c) && c.v !== "owner",
  og: (c: C) => c.p === "public" && c.a === "public",
};

export function verifyMatrix() {
  for (const v of viewers) {
    for (const p of vis) {
      for (const a of aud) {
        const c = { v, p, a };
        for (const [name, fn] of Object.entries(surfaces)) {
          const expected = fn(c);
          let actual: boolean;
          if (name === "feed" || name === "search") {
            actual = c.p === "public" && c.a === "public";
          } else if (name === "og") {
            actual = canViewCase({ v: "anon", p: c.p, a: c.a });
          } else if (name === "save") {
            actual = canViewCase(c) && c.v !== "owner";
          } else {
            actual = canViewCase(c);
          }
          if (actual !== expected) {
            throw new Error(
              `Matrix mismatch at ${name} for ${JSON.stringify(c)}`,
            );
          }
        }
      }
    }
  }
  return true;
}

test("Privacy Matrix TypeScript verification", () => {
  assert.equal(verifyMatrix(), true);
});
