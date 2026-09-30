const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["src/dist/**", "node_modules/**"] },
  {
    files: [
      "src/**/*.js",
      "api/**/*.js",
      "scripts/**/*.js",
      "test/**/*.js",
      "eslint.config.cjs",
    ],
    rules: js.configs.recommended.rules,
  },
  {
    files: [
      "src/app.js",
      "src/share.js",
      "src/prompt-format.js",
      "src/diff.js",
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "src/ai.js",
      "src/auth.js",
      "src/database.js",
      "src/diff.js",
      "src/mailer.js",
      "src/rate-limit.js",
      "src/schema.js",
      "src/security.js",
      "src/server.js",
      "src/settings.js",
      "src/speech.js",
      "api/**/*.js",
      "scripts/**/*.js",
      "test/**/*.js",
      "eslint.config.cjs",
    ],
    languageOptions: { globals: globals.node },
  },
];
