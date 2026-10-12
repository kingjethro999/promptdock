const test = require("node:test");
const assert = require("node:assert/strict");

test("Community Features Suite", async (suite) => {
  const {
    validateUsername,
    normalizeUsername,
    usernameBase,
    avatarFallback,
    RESERVED,
    USERNAME_RE,
  } = await import("../src/lib/community/username.ts");

  const {
    sniffImage,
    assertOwnedAsset,
    signCloudinaryUpload,
    LIMITS,
    HttpError,
  } = await import("../src/lib/community/uploads.ts");

  const { resolveAttribution } = await import("../src/lib/community/save.ts");

  await suite.test("Usernames: format validation and normalization", () => {
    assert.equal(normalizeUsername("  Alice_123  "), "alice_123");
    assert.ok(USERNAME_RE.test("alice_123"));
    assert.ok(RESERVED.has("community"));

    // Valid handles
    assert.equal(validateUsername("alice").ok, true);
    assert.equal(validateUsername("user-name").ok, true);
    assert.equal(validateUsername("dev_123").ok, true);

    // Invalid format
    assert.equal(validateUsername("a").ok, false); // too short (<3)
    assert.equal(validateUsername("-alice").ok, false); // starts with hyphen
    assert.equal(validateUsername("alice-").ok, false); // ends with hyphen
    assert.equal(validateUsername("alice__bob").ok, false); // double separator
    assert.equal(validateUsername("alice--bob").ok, false); // double separator
    assert.equal(validateUsername("alice!bob").ok, false); // invalid char
    assert.equal(
      validateUsername("a".repeat(31)).ok,
      false, // too long (>30)
    );

    // Reserved usernames
    assert.equal(validateUsername("community").ok, false);
    assert.equal(validateUsername("admin").ok, false);
    assert.equal(validateUsername("settings").ok, false);
    assert.equal(validateUsername("workspace").ok, false);
    assert.equal(validateUsername("pricing").ok, false);
    assert.equal(validateUsername("official").ok, false);
  });

  await suite.test("Usernames: usernameBase derivations", () => {
    assert.equal(usernameBase({ name: "Jöhn Dóe" }), "john-doe");
    assert.equal(usernameBase({ email: "creator@example.com" }), "creator");
    assert.equal(usernameBase({ email: "admin@example.com" }), "creator"); // reserved fallbacks to creator
    assert.equal(usernameBase({ name: "A" }), "creator"); // too short falls back
  });

  await suite.test("Usernames: avatar fallback", () => {
    const a1 = avatarFallback("alice", 6);
    const a2 = avatarFallback("alice", 6);
    assert.equal(a1.letter, "A");
    assert.equal(a1.tone, a2.tone); // deterministic
    assert.ok(a1.tone >= 0 && a1.tone < 6);
  });

  await suite.test("Uploads: image sniffing rejects SVG and bad files", () => {
    // PNG magic bytes
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    assert.equal(sniffImage(pngBytes), "image/png");

    // JPEG magic bytes
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    assert.equal(sniffImage(jpegBytes), "image/jpeg");

    // WEBP magic bytes (RIFF....WEBP)
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    assert.equal(sniffImage(webpBytes), "image/webp");

    // SVG / XML / plain text rejected
    const svgBytes = Buffer.from(
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    );
    assert.equal(sniffImage(new Uint8Array(svgBytes)), null);

    // Empty / short buffer rejected
    assert.equal(sniffImage(new Uint8Array([1, 2, 3])), null);
  });

  await suite.test("Uploads: byte limits", () => {
    assert.equal(LIMITS.avatar.maxBytes, 2_000_000);
    assert.equal(LIMITS.banner.maxBytes, 4_000_000);
  });

  await suite.test(
    "Uploads: assertOwnedAsset protects against cross-user spoofing",
    () => {
      process.env.COMMUNITY_ASSET_HOST = "res.cloudinary.com";
      const userA = "11111111-1111-1111-1111-111111111111";
      const userB = "22222222-2222-2222-2222-222222222222";

      // Valid asset for userA
      assert.doesNotThrow(() => {
        assertOwnedAsset(
          `https://res.cloudinary.com/dcrh78d8z/image/upload/community/${userA}/avatar-123.png`,
          userA,
        );
      });

      // User B trying to claim User A's asset URL must throw 400 bad_asset
      assert.throws(
        () => {
          assertOwnedAsset(
            `https://res.cloudinary.com/dcrh78d8z/image/upload/community/${userA}/avatar-123.png`,
            userB,
          );
        },
        (err) =>
          err instanceof HttpError &&
          err.status === 400 &&
          err.message === "bad_asset",
      );

      // Untrusted host must throw
      assert.throws(
        () => {
          assertOwnedAsset(
            `https://evil.com/community/${userA}/avatar.png`,
            userA,
          );
        },
        (err) => err instanceof HttpError && err.status === 400,
      );

      // Non-https must throw
      assert.throws(
        () => {
          assertOwnedAsset(
            `http://res.cloudinary.com/community/${userA}/avatar.png`,
            userA,
          );
        },
        (err) => err instanceof HttpError && err.status === 400,
      );
    },
  );

  await suite.test(
    "Uploads: signCloudinaryUpload returns signed parameters",
    () => {
      process.env.CLOUDINARY_API_KEY = "489659887456251";
      process.env.CLOUDINARY_CLOUD_NAME = "dcrh78d8z";
      process.env.CLOUDINARY_SECRET = "O3oRhY0-yeMy7Q9QZtsN92r0RNs";

      const payload = signCloudinaryUpload("user-test-1", "avatar");
      assert.ok(payload.uploadUrl.includes("dcrh78d8z"));
      assert.equal(payload.fields.api_key, "489659887456251");
      assert.equal(payload.fields.folder, "community/user-test-1");
      assert.ok(payload.fields.signature.length > 20);
      assert.equal(payload.maxBytes, 2_000_000);
    },
  );

  await suite.test(
    "Attribution: resolveAttribution hides private/deleted source",
    async () => {
      // Null source prompt id returns null
      const noAttribution = await resolveAttribution("viewer-1", {
        sourcePromptId: null,
      });
      assert.equal(noAttribution, null);

      // Non-existent or private source prompt returns { unavailable: true }
      const unavail = await resolveAttribution("viewer-1", {
        sourcePromptId: "00000000-0000-0000-0000-000000000000",
      });
      assert.deepEqual(unavail, { unavailable: true });
    },
  );
});
