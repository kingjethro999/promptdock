# PromptDock Repository & Design System Guardrails

## 1. Zero UI Improvisation (Strict Invariant)

When creating or extending any view, page, or state in PromptDock:

- **Never use generic emojis or Unicode icons** (e.g., `🔍`, `☰`, `↗`, `🌐`) as UI elements or icons.
- **Always use inline SVGs** matching PromptDock's stroke width (2.0–2.5px), rounded linecaps, and color tokens.
- **Empty & Error States**:
  - Always follow the canonical pattern from `src/styles/shared/styles.css` and `src/components/library/LibraryWorkspace.tsx`:
    ```tsx
    <div className="empty-state" role={isError ? "alert" : undefined}>
      <div className="empty-state-icon">✳</div>
      <h3>{headline}</h3>
      <p>{description}</p>
      {action && <Button variant="primary">{label}</Button>}
    </div>
    ```
  - Never invent custom dashed wireframe boxes or stack empty and error states together simultaneously.
- **Design System Buttons**:
  - Always use `@/components/ui/Button` (`variant="primary"`, `"secondary"`, `"outline"`, `"quiet"`). It integrates PromptDock's `LiquidButton` micro-interactions and loading/disabled states.
  - Never drop raw unstyled `<button>` or unstyled `<a>` tags for primary navigation or CTAs.

## 2. Branding & Header Invariants

- **Do not blindly reuse `.brand` on light backgrounds**: The `.brand` class in `src/styles/shared/styles.css` is hardcoded for the dark workspace sidebar (`color: #fff; margin-bottom: 56px;`).
- Public headers must use dedicated classes (e.g., `.landing-logo` or `.community-nav-brand`) with `#173225` / `#182824` for "prompt", `#7ea747` / `#86b432` for "dock", aligned with flex and zero bottom margin.
- The brand mark SVG must always use `#182824` fill on the green `#d7f477` rounded badge with two `#d7f477` dots, or the signature `✳` mark.

## 3. Architecture & Client/Server Boundaries

- **Pure Client Module Rule**: Files imported by client components (e.g., `src/lib/community/access.ts`, `src/lib/community/username.ts`) must remain 100% pure TypeScript. NEVER import Node.js APIs (`node:crypto`, `node:module`, `pg`, `database.js`) in client-accessible modules.
- **Database Access**: All queries live in server-only modules (e.g., `src/lib/community/queries.ts`, `src/backend.js`, `src/database.js`).
- **Content Security Policy (CSP)**:
  - Any inline `<script>` in `src/app/layout.tsx` must pass `nonce={nonce}` retrieved via `(await headers()).get("x-nonce")`.
  - In `src/proxy.ts`, `script-src` must include any necessary static SHA-256 fallback hashes.
- **Production Build**: Next.js 16 webpack build (`next build --webpack`) is the canonical production build command.
