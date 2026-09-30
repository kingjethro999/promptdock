const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const settings = require("../src/settings");
const mailer = require("../src/mailer");

test("personal provider keys encrypt, decrypt, and stay bound to one user", () => {
  const env = { BYOK_ENCRYPTION_KEY: randomBytes(32).toString("hex") };
  const key = "provider-example-secret";
  const ciphertext = settings.encryptKey("user-one", key, env);
  assert.ok(!ciphertext.includes(key));
  assert.equal(settings.decryptKey("user-one", ciphertext, env), key);
  assert.throws(() => settings.decryptKey("user-two", ciphertext, env));
});

test("personal provider settings require a supported provider and model", () => {
  assert.deepEqual(
    settings.validateSetting({
      provider: "groq",
      model: "openai/gpt-oss-120b",
      apiKey: "example-key",
    }),
    { provider: "groq", model: "openai/gpt-oss-120b", apiKey: "example-key" },
  );
  assert.deepEqual(
    settings.validateSetting({
      provider: "apmix",
      model: "provider/model",
      apiKey: "example-key",
    }),
    { provider: "apmix", model: "provider/model", apiKey: "example-key" },
  );
  assert.throws(() =>
    settings.validateSetting({
      provider: "custom",
      model: "model",
      apiKey: "example-key",
    }),
  );
  assert.throws(() =>
    settings.validateSetting({
      provider: "gemini",
      model: "https://example.com/?x=1",
      apiKey: "example-key",
    }),
  );
});

test("email links use the configured public origin", () => {
  const env = { APP_URL: "https://promptdock.example" };
  const link = new URL(mailer.authLink("verify", "a".repeat(64), env));
  assert.equal(link.origin, "https://promptdock.example");
  assert.equal(link.searchParams.get("verify"), "a".repeat(64));
  assert.equal(
    mailer.appUrl({ VERCEL_PROJECT_PRODUCTION_URL: "promptdock.example" }),
    "https://promptdock.example",
  );
  assert.equal(
    mailer.configured({
      GMAIL_USER: "owner@example.com",
      GMAIL_APP_PASSWORD: "example",
    }),
    true,
  );
});
