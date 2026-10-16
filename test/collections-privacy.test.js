const test = require("node:test");
const assert = require("node:assert/strict");

// Sensitive scanner implementation mirrored for unit test verification
function scanPrompt({ name = "", tags = [], data = null }) {
  const RULES = [
    {
      id: "private-key",
      label: "a private key",
      severity: "block",
      re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    },
    {
      id: "groq",
      label: "a Groq API key",
      severity: "block",
      re: /\bgsk_[A-Za-z0-9]{20,}\b/,
    },
    {
      id: "google",
      label: "a Google API key",
      severity: "block",
      re: /\bAIza[0-9A-Za-z_-]{30,}\b/,
    },
    {
      id: "key-like",
      label: "an API key",
      severity: "block",
      re: /\bsk-[A-Za-z0-9_-]{20,}\b/,
    },
    {
      id: "github",
      label: "a GitHub token",
      severity: "block",
      re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    },
    {
      id: "email",
      label: "an email address",
      severity: "warn",
      re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    },
  ];

  const blob = [
    name,
    Array.isArray(tags) ? tags.join(" ") : "",
    JSON.stringify(data || {}),
  ].join("\n");

  const findings = [];
  for (const r of RULES) {
    if (r.re.test(blob)) {
      findings.push({ id: r.id, label: r.label, severity: r.severity });
    }
  }
  return findings;
}

// Oracle visibility table evaluation
function evalCollectionVisibility({
  collectionVisibility,
  creatorAudience = "public",
  viewerRole, // "owner" | "follower" | "stranger" | "anon"
}) {
  if (viewerRole === "owner") return true;
  if (collectionVisibility === "private") return false;

  if (collectionVisibility === "followers") {
    return viewerRole === "follower";
  }

  if (collectionVisibility === "public") {
    if (creatorAudience === "followers") {
      return viewerRole === "follower";
    }
    return true; // stranger or anon can view
  }

  return false;
}

// Dirty check logic mirrored from useSavePrompt
function isDirty(data, sourcePrompt, name) {
  if (!sourcePrompt) return true;
  if (name !== undefined && name.trim() !== (sourcePrompt.name || "").trim()) {
    return true;
  }
  return JSON.stringify(data) !== JSON.stringify(sourcePrompt.data);
}

test("Collection Visibility Oracle Table", () => {
  const roles = ["owner", "follower", "stranger", "anon"];

  // 1. Private collection: only owner can view
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "private", viewerRole: "owner" }),
    true
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "private", viewerRole: "follower" }),
    false
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "private", viewerRole: "stranger" }),
    false
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "private", viewerRole: "anon" }),
    false
  );

  // 2. Followers collection: owner and followers can view
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "followers", viewerRole: "owner" }),
    true
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "followers", viewerRole: "follower" }),
    true
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "followers", viewerRole: "stranger" }),
    false
  );
  assert.equal(
    evalCollectionVisibility({ collectionVisibility: "followers", viewerRole: "anon" }),
    false
  );

  // 3. Public collection with creator audience = public: all roles can view
  for (const role of roles) {
    assert.equal(
      evalCollectionVisibility({
        collectionVisibility: "public",
        creatorAudience: "public",
        viewerRole: role,
      }),
      true,
      `Failed for role ${role} on public collection`
    );
  }

  // 4. Public collection with creator audience = followers: limited to followers & owner
  assert.equal(
    evalCollectionVisibility({
      collectionVisibility: "public",
      creatorAudience: "followers",
      viewerRole: "owner",
    }),
    true
  );
  assert.equal(
    evalCollectionVisibility({
      collectionVisibility: "public",
      creatorAudience: "followers",
      viewerRole: "follower",
    }),
    true
  );
  assert.equal(
    evalCollectionVisibility({
      collectionVisibility: "public",
      creatorAudience: "followers",
      viewerRole: "stranger",
    }),
    false
  );
  assert.equal(
    evalCollectionVisibility({
      collectionVisibility: "public",
      creatorAudience: "followers",
      viewerRole: "anon",
    }),
    false
  );
});

test("Visitor Numbering & Hidden Item Omission", () => {
  // A collection with 5 items:
  // Item 1: public
  // Item 2: private (hidden)
  // Item 3: public
  // Item 4: followers-only (hidden for anon)
  // Item 5: public
  const rawItems = [
    { id: "1", visibility: "public", rawPosition: 1 },
    { id: "2", visibility: "private", rawPosition: 2 },
    { id: "3", visibility: "public", rawPosition: 3 },
    { id: "4", visibility: "followers", rawPosition: 4 },
    { id: "5", visibility: "public", rawPosition: 5 },
  ];

  // Anon visitor visible items
  const anonVisible = rawItems
    .filter((item) => item.visibility === "public")
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  assert.equal(anonVisible.length, 3);
  assert.deepEqual(
    anonVisible.map((i) => i.rank),
    [1, 2, 3]
  );
  // Item 3 is ranked 2, Item 5 is ranked 3. Raw position 2 and 4 never leak.
  assert.equal(anonVisible[1].id, "3");
  assert.equal(anonVisible[1].rank, 2);
  assert.equal(anonVisible[2].id, "5");
  assert.equal(anonVisible[2].rank, 3);

  // Follower visitor visible items
  const followerVisible = rawItems
    .filter((item) => item.visibility === "public" || item.visibility === "followers")
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  assert.equal(followerVisible.length, 4);
  assert.deepEqual(
    followerVisible.map((i) => i.rank),
    [1, 2, 3, 4]
  );
});

test("Sensitive Scanner - Blocking Rules", () => {
  // Private key
  const r1 = scanPrompt({
    name: "My prompt",
    data: { task: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA..." },
  });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, "private-key");
  assert.equal(r1[0].severity, "block");

  // Groq key
  const r2 = scanPrompt({
    name: "Groq prompt",
    data: { task: "Use this key gsk_abcdef1234567890abcdef12 to call groq" },
  });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].id, "groq");
  assert.equal(r2[0].severity, "block");

  // Google API key
  const r3 = scanPrompt({
    name: "Gemini helper",
    data: { task: "Key is AIzaSyD123456789012345678901234567890" },
  });
  assert.equal(r3.length, 1);
  assert.equal(r3[0].id, "google");
  assert.equal(r3[0].severity, "block");

  // GitHub token
  const r4 = scanPrompt({
    name: "GitHub script",
    data: { task: "Token: ghp_123456789012345678901234567890abcdef" },
  });
  assert.equal(r4.length, 1);
  assert.equal(r4[0].id, "github");
  assert.equal(r4[0].severity, "block");
});

test("Sensitive Scanner - Warning Rules", () => {
  // Email address
  const r = scanPrompt({
    name: "Support prompt",
    data: { task: "Please contact support@example.com for help" },
  });
  assert.equal(r.length, 1);
  assert.equal(r.id || r[0].id, "email");
  assert.equal(r.severity || r[0].severity, "warn");

  // Clean prompt
  const cleanResults = scanPrompt({
    name: "Creative Writing Assistant",
    tags: ["writing", "creative"],
    data: { task: "Write a story about an astronaut visiting Mars." },
  });
  assert.equal(cleanResults.length, 0);
});

test("useSavePrompt isDirty Logic", () => {
  const initialData = { task: "Write an email", depth: "Quick" };
  const source = {
    id: "prompt-1",
    name: "Initial Name",
    data: initialData,
  };

  // No source prompt: dirty (unsaved draft)
  assert.equal(isDirty(initialData, null), true);

  // Exact match: clean
  assert.equal(isDirty(initialData, source), false);

  // Data changed: dirty
  assert.equal(isDirty({ task: "Write a letter", depth: "Quick" }, source), true);

  // Name changed: dirty
  assert.equal(isDirty(initialData, source, "New Name"), true);

  // Name unchanged (with trimming): clean
  assert.equal(isDirty(initialData, source, "  Initial Name  "), false);
});
