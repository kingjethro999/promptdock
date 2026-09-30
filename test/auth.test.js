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
