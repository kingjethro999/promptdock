const test = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/auth");
const database = require("../src/database");

test("password hashes verify without storing the password", async () => {
  const password = "a-long-example-password";
  const encoded = await auth.hashPassword(password);
  assert.ok(encoded.startsWith("scrypt$"));
  assert.ok(!encoded.includes(password));
  assert.equal(await auth.verifyPassword(password, encoded), true);
  assert.equal(await auth.verifyPassword("wrong-password", encoded), false);
});

test("session cookies are HTTP only and secure over HTTPS", () => {
  const request = { headers: { "x-forwarded-proto": "https" } };
  const cookie = auth.cookieHeader("a".repeat(64), request);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(auth.clearCookie(request), /Max-Age=0/);
});

test("account keys differ from legacy browser keys", () => {
  const token = "a".repeat(64);
  assert.notEqual(
    database.accountKey("123e4567-e89b-42d3-a456-426614174000"),
    database.legacyKey(token),
  );
  assert.throws(() => database.legacyKey("bad-token"));
});

test("firebase-admin configured check and modular API contract", () => {
  const firebaseAdmin = require("../src/firebase-admin");
  assert.equal(typeof firebaseAdmin.configured, "function");
  assert.equal(typeof firebaseAdmin.getAuth, "function");
  assert.equal(typeof firebaseAdmin.getFirestore, "function");
  assert.ok(firebaseAdmin.admin?.firestore?.FieldValue);
  assert.equal(typeof firebaseAdmin.FieldValue?.serverTimestamp, "function");
});

test("providerUidFrom extracts provider UID from providerData, identities, or decoded UID", () => {
  const decoded = {
    uid: "promptdock-user-uuid",
    firebase: {
      identities: {
        "github.com": ["121499565"],
        "google.com": ["google-sub-999"],
      },
      sign_in_provider: "github.com",
    },
  };

  const firebaseUser = {
    providerData: [
      { providerId: "github.com", uid: "121499565" },
      { providerId: "google.com", uid: "google-sub-999" },
    ],
  };

  assert.equal(
    auth.providerUidFrom(decoded, "github", firebaseUser),
    "121499565",
  );
  assert.equal(
    auth.providerUidFrom(decoded, "google", firebaseUser),
    "google-sub-999",
  );
  assert.equal(auth.providerUidFrom(decoded, "github"), "121499565");
  assert.equal(
    auth.providerUidFrom({ uid: "fallback-id" }, "github"),
    "fallback-id",
  );
});

test("firebaseIdentity allows GitHub with email even when email_verified is false, but enforces verified email for Google", async () => {
  const firebaseAdmin = require("../src/firebase-admin");
  const originalGetAuth = firebaseAdmin.getAuth;

  try {
    let mockDecoded;
    firebaseAdmin.getAuth = () => ({
      verifyIdToken: async () => mockDecoded,
    });

    mockDecoded = {
      uid: "github-user-id",
      email: "user@example.com",
      email_verified: false,
      firebase: { sign_in_provider: "github.com" },
    };
    const ghResult = await auth.firebaseIdentity({ idToken: "token" });
    assert.equal(ghResult.provider, "github");
    assert.equal(ghResult.email, "user@example.com");

    mockDecoded = {
      uid: "google-user-id",
      email: "user@example.com",
      email_verified: false,
      firebase: { sign_in_provider: "google.com" },
    };
    await assert.rejects(
      () => auth.firebaseIdentity({ idToken: "token" }),
      /Google did not provide a verified email address/,
    );

    mockDecoded = {
      uid: "github-no-email",
      email: "",
      email_verified: false,
      firebase: { sign_in_provider: "github.com" },
    };
    await assert.rejects(
      () => auth.firebaseIdentity({ idToken: "token" }),
      /GitHub did not provide an email address/,
    );
  } finally {
    firebaseAdmin.getAuth = originalGetAuth;
  }
});
