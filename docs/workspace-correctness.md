# Workspace document and request state

The workspace keeps a current document independently of the next refinement request. This is a correctness foundation, not the completed workspace/PWA redesign.

## State contract

- `idea`, `guidance`, research mode, reference URL and attachments describe the next request. Editing them must not silently rewrite or delete the current result.
- `result.data` is the current document. `ready` means it can be shown/edited, **not** that AI refinement succeeded. `source-preserved` is an explicit unverified fallback; a failed refinement retains an existing usable document.
- `documentSource` records the source associated with that result. Saving an existing result uses this snapshot, not unsubmitted changes in the composer.
- `revision` invalidates pending generation/clarification work. Starting a request also advances it. Ownership is checked after image preparation and before HTTP dispatch, as well as before accepting a response, showing a request error or clearing `busy`.
- `documentRevision` advances on replacement, edits, clear and hydration. Run/Compare results belong to that version and the exact exported text, including profile/temporary variables. Late responses cannot overwrite a later version's execution state.
- `documentEdited` distinguishes manual edits. Whole-document editing stores a compatible raw `PromptData` document and clears structured fields already incorporated into its text. Request guidance remains independent.

The existing account-specific draft keys and `SavedPrompt` database schema are unchanged. Ready drafts without `documentSource` predate the document/request split: hydration materializes their former guidance overlay into the current document so unsaved edits survive the upgrade. Drafts with the source snapshot already use the new semantics and never apply that overlay again. Session-local request/version counters are not restored from storage.

## Export semantics

All raw-document profiles preserve the original document and append nonempty structured field edits without wrapping the source in a second task. Copy and download contain the same exported text; downloads no longer add an unsolicited heading or trailing newline. Variable substitution is temporary for copy/download/Run/Compare. Save retains the reusable template rather than those temporary values.

## Verification

```bash
node --test test/format.test.js test/prompt-builder-state.test.js test/prompt-builder-generation.test.js test/prompt-preview.test.js
npm test
npm run ci:verify
node scripts/workspace-preview-qa.cjs
```

The last command bundles the real client store/hooks/preview with the installed Next webpack compiler and launches Playwright against a temporary localhost fixture. It uses installed `/usr/bin/google-chrome` by default; set `BROWSER_EXECUTABLE` to another Chromium executable if needed. External URLs are blocked and all API responses are synthetic. It does not load environment files, bypass production authentication or contact a provider/database. Temporary compiler output is removed after the run.

The browser check covers source retention, direct editing/focus, copy/download/save agreement, stale Run/Compare responses, variable reset, fallback labeling, and horizontal overflow at 320/360/390/412/768/1280px. Component tests additionally cover readiness, stale errors, same-text document switches and profile changes.

This evidence does not establish full signed-in route behavior, live model quality, physical mobile keyboards, PWA installation or production incident closure. The unified composer/layout, scoped PWA, save/remix concurrency and the wider security/research/Community audit acceptance criteria remain separate work.
