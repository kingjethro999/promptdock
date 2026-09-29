# PromptDock

A prompt workspace for ChatGPT, Claude, Gemini, and other AI tools. Write a task, add context and constraints, then copy the structured prompt. Includes AI suggestions, quick-start templates, a prompt quality guide, a searchable saved library, and Markdown export.

## Run

Requires Node.js 20.12 or newer. No dependencies are needed. The manual builder works without an API key.

```bash
npm start
```

Open <http://localhost:3000>.

Prompts are saved in your browser's local storage. The platform buttons copy your prompt and open the selected platform in a new tab. Paste the prompt there to use it.

## AI suggestions

The server reads the local `.env` file at startup. Copy `.env.example` to `.env` if you need a template. “Enhance with AI” sends the current draft to a configured provider. It follows `AI_PROVIDER_ORDER` and `AI_MAX_FALLBACKS`, supporting APMIX, Groq, and Gemini. Provider keys remain on the server. The `.env` file is ignored by Git. Restart the server after changing `.env`.

The AI action is optional; ordinary typing, saving, copying, and exporting do not send prompts to a provider. The server listens only on `127.0.0.1`.

## Versioning

The project starts at `v0.0.1`. The first Git commit keeps that version. The included pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then increments the middle number through `v0.599.0 → v1.0.0`. From `v1.0.0` onward it increments the patch number. `package.json` uses the numeric SemVer form; `VERSION` and the UI use the `v` prefix.

Run `npm run setup:hooks` after cloning to activate the repository hook.
