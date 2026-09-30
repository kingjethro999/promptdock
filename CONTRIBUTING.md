# Contributing to PromptDock

Thanks for helping improve PromptDock. Bug reports, documentation fixes, design improvements, and code changes are welcome.

## Before you start

- Search existing issues and pull requests so work is not duplicated. For a larger feature, open an issue first to agree on its scope.
- Keep changes focused on turning ideas into useful prompts, managing a personal library, and sharing prompts safely.
- Never post API keys, database URLs, email app passwords, session cookies, private prompts, or user data in an issue, pull request, screenshot, or commit.

## Set up locally

Use Node.js 24 for the full test suite. Clone the repository, then run:

```bash
npm ci
npm run setup:hooks
cp .env.example .env
npm start
```

Open <http://localhost:3000>. The manual prompt builder works without provider keys or PostgreSQL. To work on account, sync, or AI features, add your own development credentials to the ignored `.env` file. Use a development database and account; do not connect tests or local experiments to the production database.

The browser UI and API live in `src/`. `api/index.js` is the Vercel entry point, and `src/schema.js` contains additive database setup. Keep secrets in server environment variables, never in browser code or committed files.

## Make a change

1. Create a branch from `main` and make a focused change.
2. Add or update tests when behavior changes. Keep tests independent of live providers, email delivery, and the production database.
3. If you change security headers, edit `src/security.js` and run `npm run headers:sync` to update `vercel.json`.
4. If you change the database, make the schema update safe for existing installations and describe any migration or deployment impact in the pull request.
5. Run the checks below before opening a pull request:

```bash
npm run lint
npm test
npm run headers:check
npm run build:frontend
```

The pre-commit hook runs lint and bumps the project version on each commit. Let the hook update `VERSION`, `package.json`, and `package-lock.json`; do not set those versions by hand. The version sequence is explained in [README.md](README.md#versioning).

## Open a pull request

Describe what changed, why it helps users, and how you verified it. Include screenshots for visible UI changes and note any new environment variables, database changes, or provider costs. Keep unrelated formatting or refactors in separate pull requests so the behavior is easy to review.

By submitting a contribution, you agree that your contribution is licensed under the project's [MIT License](LICENSE).
