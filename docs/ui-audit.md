# PromptDock UI Audit & Kit Plan

## 1. Executive Summary

PromptDock currently contains three coexisting generations of UI controls:
1. **Original workspace controls**: `react-field`, `react-password-field`, `search-select`, and `LiquidButton`.
2. **Community & recent features**: `community-btn`, `community-search-input`, raw `<input type="radio">`, and occasional inline `style={{}}`.
3. **Glyphs**: Text glyphs such as `✳`, `↗`, `✦`, `⚙`, `✎`, `✓`, `☰`, `→` used directly in templates.

Per user instruction, **glyphs are not emojis and will not be removed**. Instead, an adaptive/SVG fallback system (`Glyph`) ensures they render consistently across all operating systems without turning into colored mobile emojis.

This consolidation pass creates a unified UI kit in `src/components/ui/`, promotes robust existing primitives (such as `LiquidButton`), eliminates raw `<input>`, `<select>`, `<textarea>`, and `<button>` outside of `src/components/ui/`, and migrates unauthenticated routes first.

---

## 2. Route Inventory

### A. Unauthenticated Routes (Public Surface)
| Route | Component File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page, hero, live demo, footer, and feedback modal |
| `/auth` | `src/app/auth/page.tsx` | Sign in & Sign up tabbed form, Google/GitHub OAuth triggers |
| `/community` | `src/app/community/page.tsx` | Community Explorer (Prompts tab + Creators tab, search & filters) |
| `/:username` | `src/app/[username]/page.tsx` | Public creator profile, prompt grid, follower counts, follow action |
| `/p/:publicId` | `src/app/p/[publicId]/page.tsx` | Shared prompt view, copy/save/remix actions |
| `/invite/:code` | `src/app/invite/[code]/page.tsx` | Referral invitation landing with crawlable previews |
| `/updates` | `src/app/updates/page.tsx` | Product changelog and release notes |
| `/updates/:id` | `src/app/updates/[id]/page.tsx` | Single release update view |
| `/privacy` | `src/app/privacy/page.tsx` | Legal privacy policy |
| `/terms` | `src/app/terms/page.tsx` | Legal terms of service |
| `/copyright` | `src/app/copyright/page.tsx` | Legal copyright policy |
| `404 / Error` | `src/app/not-found.tsx` | Not found error page |

### B. Authenticated Routes (App Surface)
| Route | Component File | Description |
|---|---|---|
| `/workspace` | `src/app/(workspace)/workspace/page.tsx` | Main idea-to-prompt builder, interactive drawer |
| `/library` | `src/app/(workspace)/library/page.tsx` | User's prompt library, cards, sharing modal, backup import/export |
| `/settings` | `src/app/(workspace)/settings/page.tsx` | Account preferences, Public Profile editor, AI provider keys |
| `/admin` | `src/app/admin/page.tsx` | Admin management, feedback review, analytics |

---

## 3. Evidence & Count Audit (Command Outputs)

| Metric | Total in `src` | Unauthenticated Routes | Authenticated Routes | UI Kit Internal |
|---|---|---|---|---|
| **Raw form controls** (`<input>`, `<select>`, `<textarea>`, `<button>`, `<option>`) | **130** | 24 | 99 | 7 |
| **Native `<select>`** | **1** | 1 (`PromptGrid.tsx:107`) | 0 | 0 |
| **Inline `style={{}}` attributes** | **48** | 22 | 25 | 1 |
| **Legacy control classes** (`community-btn`, `community-search-input`, `primary-button`, etc.) | **111** (all files) / **36** (in TSX) | 13 | 23 | 0 |

### Command Proof:
```bash
# Raw controls in TSX
grep -rnE "<(input|select|textarea|button|option)\b" src --include=*.tsx | wc -l
# Result: 130

# Native select elements
grep -rnE "<select\b" src --include=*.tsx
# Result: src/components/community/PromptGrid.tsx:107:          <select

# Inline styles in TSX
grep -rnE "style=\{\{" src --include=*.tsx | wc -l
# Result: 48

# Legacy classes
grep -rnE "community-(btn|search-input)|primary-button|secondary-button|text-button|react-field|search-select" src | wc -l
# Result: 111 (includes CSS definition files and TSX)
```

---

## 4. Control Species Inventory

| Species | Occurrences (File:Line) | Type | Focus Ring | Disabled / Invalid | Dark Theme | Keyboard Accessible | Action |
|---|---|---|---|---|---|---|---|
| **Text input** | `src/components/auth/AuthForm.tsx:141`<br>`src/components/settings/PublicProfileSettings.tsx:244` | Native `<input>` | Partial | Inconsistent | Partial | Yes | **Rebuild / Promote** to `TextField` |
| **Password input** | `src/components/auth/AuthForm.tsx:165` | Native `<input type="password">` | Partial | Yes | Yes | Yes | **Promote** to `PasswordField` with `IconButton` eye toggle |
| **Search box** | `src/components/community/CommunityExplorer.tsx:64`<br>`src/components/library/LibraryWorkspace.tsx:150` | Native `<input type="search">` | Custom | No | Yes | Yes | **Promote** to `SearchInput` with SVG clear button and `/` shortcut |
| **Dropdown / Select** | `src/components/community/PromptGrid.tsx:107`<br>`src/components/ui/SearchSelect.tsx` | 1 Native `<select>`, 1 Custom Listbox | OS / Yes | Partial | Partial | Partial (no portal, no coarse sheet) | **Rebuild** into `Select` with portal, full keyboard contract, and bottom sheet |
| **Textarea** | `src/components/landing/LandingFeedbackModal.tsx:84`<br>`src/components/settings/PublicProfileSettings.tsx:288` | Native `<textarea>` | Partial | No | Yes | Yes | **Promote** to `TextArea` with auto-grow |
| **Checkbox** | `src/components/library/SharePromptDialog.tsx:120` | Native `<input type="checkbox">` | Default OS | Yes | Partial | Yes | **Promote** to styled `Checkbox` (44px touch target) |
| **Radio / Choice cards** | `src/components/settings/PublicProfileSettings.tsx:326`<br>`src/components/library/SharePromptDialog.tsx:96` | Raw `<input type="radio">` | Inconsistent | Yes | Yes | Yes | **Promote** to `Radio` and `ChoiceCard` |
| **Switch** | `src/components/library/SharePromptDialog.tsx:180` | Native checkbox | Custom | Yes | Yes | Yes | **Promote** to `Switch` (`role="switch"`) |
| **File button** | `src/components/settings/PublicProfileSettings.tsx:190` | Raw `<input type="file">` | None | Partial | Yes | Partial | **Promote** to `FileButton` (styled trigger over hidden input) |
| **Button (Primary/Sec/Ghost)** | `src/components/ui/LiquidButton.tsx`<br>`src/components/ui/Button.tsx` | Custom component | Yes | Yes | Yes | Yes | **Promote & Unify** to kit `Button` and `IconButton` |
| **Link styled as button** | `src/components/landing/LandingPage.tsx:120` | Next.js `<Link>` with button classes | Yes | N/A | Yes | Yes | **Promote** to `LinkButton` |

---

## 5. Glyphs vs. Emojis Architecture

### The User Invariant
> *"As for the glyphs, do not remove them, create an SVG fallback depending on the device, do not remove them completely. Glyphs are not emojis."*

### Why System Emojis Break Glyphs
On iOS and Android, characters like `✳` (U+2733, Eight-Spoked Asterisk) and `↗` (U+2197, North East Arrow) frequently fall back to system emoji fonts (Apple Color Emoji, Noto Color Emoji), which render them as colored, multicolored illustrations instead of monochromatic brand glyphs matching `currentColor`.

### Solution: `Glyph` Component
The new `src/components/ui/Glyph.tsx` supports both:
1. **Direct SVG rendering** with identical vector stroke geometry (e.g. `spark`, `star`, `arrow-up-right`, `command`, `pencil`), guaranteeing crisp monochrome rendering in `currentColor` on mobile.
2. **Preservation of text glyphs** where desired, wrapped with clean font inheritance.

---

## 6. Design Tokens & Form Sizing

### Existing Tokens:
- Radii: `var(--existing-radius-field)` / 9px–10px standard.
- Colors:
  - Surface: `--community-surface` (#ffffff light / #14221c dark)
  - Background: `--community-bg` (#f7f8f3 light / #0e1814 dark)
  - Borders: `--community-border` (#dbe2dc light / #23382e dark)
  - Text: `--community-text` (#1d2a25 light / #f7f8f3 dark)
  - Muted: `--community-muted` (#5e7467 light / #95aba0 dark)
  - Accent: `--community-accent` (#86b432 light / #c7f464 dark)

### UI Kit Tokens (`src/styles/next/ui-kit.css`):
```css
:root {
  color-scheme: light;
  --ui-h-sm: 36px;
  --ui-h-md: 44px; /* default touch target */
  --ui-h-lg: 52px;
  --ui-radius: 9px;
  --ui-bg: #fcfdf9;
  --ui-fg: #1d2a25;
  --ui-border: #dbe2dc;
  --ui-border-hover: #98c844;
  --ui-focus: #98c844;
  --ui-danger: #dc2626;
  --ui-placeholder: #5e7467;
  --ui-on-accent: #ffffff;
}

[data-theme="dark"], .dark {
  color-scheme: dark;
  --ui-bg: #14221c;
  --ui-fg: #f7f8f3;
  --ui-border: #23382e;
  --ui-border-hover: #c7f464;
  --ui-focus: #c7f464;
  --ui-danger: #f87171;
  --ui-placeholder: #95aba0;
  --ui-on-accent: #0e1814;
}
```

---

## 7. Migration Sequence

1. **Install Pre-approved Dependencies**:
   - `lucide-react` (for consistent SVG icons)
   - `@axe-core/playwright` (dev-dependency for accessibility testing)
2. **Build UI Kit Primitives** (`src/components/ui/`):
   - `Icon.tsx`, `Glyph.tsx`, `Button.tsx`, `IconButton.tsx`, `LinkButton.tsx`
   - `FormField.tsx`, `TextField.tsx`, `PasswordField.tsx`, `TextArea.tsx`, `SearchInput.tsx`
   - `Select.tsx` (portal, keyboard listbox, coarse bottom sheet)
   - `Checkbox.tsx`, `Radio.tsx`, `RadioGroup.tsx`, `ChoiceCard.tsx`, `Switch.tsx`, `FileButton.tsx`
   - `index.ts`
3. **Build Dev Gallery**:
   - `/dev/ui` (rendering all primitives and states in light and dark)
4. **Setup Lint & Enforcement Rules**:
   - ESLint restricted syntax for raw controls on unauthenticated routes
   - Updated no-emoji/glyph source test
   - Playwright runtime DOM consistency test (`tests/ui-consistency.spec.ts`)
5. **Migrate Unauthenticated Routes**:
   - `/auth` (AuthForm)
   - `/` (Landing & Feedback modal)
   - `/community`, `/:username`, `/p/:publicId`, `/invite/:code`, Legal pages
6. **Migrate Community & Settings Controls**:
   - PromptGrid, PublicProfileSettings, SharePromptDialog
7. **Final Verification**:
   - Run typecheck, lint, full test suite, visual screenshots comparison in `qa/ui-after/`.
