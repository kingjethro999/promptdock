const js = require("@eslint/js");
const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = [
  { ignores: ["oldui/dist/**", ".next/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-require-imports": "off" } },
  {
    files: [
      "src/**/*.js",
      "oldui/**/*.js",
      "scripts/**/*.js",
      "test/**/*.js",
      "eslint.config.cjs",
    ],
    rules: js.configs.recommended.rules,
  },
  {
    files: [
      "oldui/app.js",
      "oldui/dev-reload.js",
      "oldui/auth-page.js",
      "oldui/admin.js",
      "oldui/updates-data.js",
      "oldui/updates-page.js",
      "oldui/share.js",
      "oldui/prompt-format.js",
      "oldui/diff.js",
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/research/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        AbortSignal: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
  },
  {
    files: [
      "src/ai.js",
      "src/prompt-policy.js",
      "src/auth.js",
      "src/database.js",
      "src/backend.js",
      "src/diff.js",
      "src/mailer.js",
      "src/rate-limit.js",
      "src/referrals.js",
      "src/schema.js",
      "src/security.js",
      "src/server.js",
      "src/settings.js",
      "src/speech.js",
      "src/updates.js",
      "src/feed.js",
      "src/firebase-admin.js",
      "src/admin-server.js",
      "oldui/server.js",
      "oldui/diff.js",
      "oldui/vercel-api.js",
      "scripts/**/*.js",
      "test/**/*.js",
      "eslint.config.cjs",
    ],
    languageOptions: { globals: globals.node },
  },
];
