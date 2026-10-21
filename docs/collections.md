# Prompt Collections & Save Architecture

## 1. Overview

Collections introduce prompt series/playlists to PromptDock. A creator can organize prompts into an ordered sequence, publish them with safety scans, and share a single link (`/c/:publicId`) with step navigation (`Part 3 of 7 in ...`). Saving in the workspace is upgraded to a split button (`| Save prompt | v |`), saving instantly to the Library and allowing one-tap addition to collections.

---

## 2. Decision Needed: Legacy Listing Migration

> [!WARNING]
> **Privacy Pre-Flight Finding**: Migration `community_legacy_public_prompts_listed_v1` in `src/schema.js` automatically set `listed_in_community = true` for every prompt that had a public link (`visibility = 'public'`).
> If deployed in production, prompts previously shared via private 1-on-1 links were listed in the global community feed.

### Audit Query

```sql
SELECT count(*)::int AS total_listed,
       count(*) FILTER (WHERE listed_at <= '2026-10-12 11:20:00+01')::int AS before_migration_time
FROM prompts
WHERE listed_in_community = true AND listed_at IS NOT NULL;
```

### Proposed Corrective Migration (Unapplied - Pending Owner Decision)

```sql
UPDATE prompts SET
  listed_in_community = false,
  listed_at = NULL
WHERE listed_in_community = true
  AND listed_at <= '2026-10-12 11:20:00+01'
  AND public_id IS NOT NULL;
```

_Note: Public direct links (`/p/:publicId`) remain functional, but prompts are unlisted from the global feed unless explicitly republished._

---

## 3. Data Model

```sql
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','followers','public')),
  listed_in_community boolean NOT NULL DEFAULT false,
  listed_at timestamptz,
  public_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT listed_in_community OR visibility <> 'private')
);

CREATE UNIQUE INDEX IF NOT EXISTS collections_owner_name_key ON collections (owner_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS collections_public_id_key ON collections (public_id) WHERE public_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS collections_owner_idx ON collections (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS collections_listed_idx ON collections (listed_at DESC, id DESC) WHERE listed_in_community AND visibility = 'public';

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  position integer NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS collection_items_order_idx ON collection_items (collection_id, position, added_at, prompt_id);
CREATE INDEX IF NOT EXISTS collection_items_prompt_idx ON collection_items (prompt_id);
```

### Constraints & Invariants

- Cascade deletes: hard-deleting a prompt cascades items out of collections.
- Unique on `(owner_id, lower(name))`: no duplicate collection names per user.
- Limits: 50 collections per user, 200 items per collection.

---

## 4. Visibility & Access Rules

### Who Can Open a Collection

| Collection Visibility                   | Anon     | Stranger | Follower | Owner |
| --------------------------------------- | -------- | -------- | -------- | ----- |
| `private`                               | No (404) | No (404) | No (404) | Yes   |
| `followers`                             | No (404) | No (404) | Yes      | Yes   |
| `public` (creator audience = public)    | Yes      | Yes      | Yes      | Yes   |
| `public` (creator audience = followers) | No (404) | No (404) | Yes      | Yes   |

### Visible Items & Numbering

- **Invariance**: A collection's visibility **never** escalates access to a prompt.
- Visitors only see items matching `visibleToViewerSql`.
- Numbering shown to visitors (`1, 2, 3...`) is the rank among **visible** items, never the raw internal `position`. Hidden items are omitted silently without placeholders or count leakage.

---

## 5. API Reference

All collection routes live under `/api/collections/`.

| Method & Path                                 | Auth  | Purpose                                                           | Response / Status                       |
| --------------------------------------------- | ----- | ----------------------------------------------------------------- | --------------------------------------- |
| `GET /api/collections?prompt=<uuid>`          | Owner | List owner's collections with membership flag                     | `{ collections: [...] }`                |
| `POST /api/collections`                       | Owner | Create collection (`name`, `description`, `visibility`, `listed`) | `201` / `409 name_taken`                |
| `PATCH /api/collections/:id`                  | Owner | Rename, describe, update visibility or listing                    | `200`                                   |
| `DELETE /api/collections/:id`                 | Owner | Delete collection (items cascade, prompts untouched)              | `200`                                   |
| `POST /api/collections/:id/items`             | Owner | Add prompt `{ promptId }`                                         | `200` (`{ added, count }`) / `409 full` |
| `DELETE /api/collections/:id/items/:promptId` | Owner | Remove prompt from collection                                     | `200`                                   |
| `PUT /api/collections/:id/order`              | Owner | Reorder items `{ promptIds: string[] }`                           | `200` / `409 stale`                     |
| `POST /api/collections/:id/publish-prompts`   | Owner | Scan and bulk-publish private prompts                             | `{ updated, blocked, needsAck }`        |

---

## 6. Save Control Behavior

| User Action                              | Main Segment                      | Chevron / Popover                          | Network / DB                                  |
| ---------------------------------------- | --------------------------------- | ------------------------------------------ | --------------------------------------------- |
| Click "Save prompt" (unsaved draft)      | Transitions to "Saving" ➔ "Saved" | Opens Popover ("Saved to Library")         | `PUT /api/prompts`                            |
| Click "Saved" (unchanged)                | No action                         | Opens Popover                              | 0 requests                                    |
| Click "Save changes" (edited)            | Transitions to "Saving" ➔ "Saved" | Opens Popover ("Saved to Library")         | `PUT /api/prompts` (new revision)             |
| Click chevron `v`                        | Unchanged                         | Opens Popover ("Save to")                  | 0 requests upfront                            |
| Toggle collection checkbox               | Unchanged                         | Optimistic update, inline error on failure | `POST` or `DELETE /api/collections/:id/items` |
| Close Popover (Esc, outside click, Done) | Unchanged                         | Closes                                     | 0 requests; prompt stays in Library           |
| "New collection"                         | Unchanged                         | Inline creation row                        | `POST /api/collections` + auto-add            |
| "Name and tags"                          | Unchanged                         | Opens AppDialog details modal              | Prefills existing name and tags               |

---

## 7. Adding SaveToPanel to New Surfaces

To add the Save/Collection popover to a new card or button:

```tsx
import { Popover } from "@/components/ui/Popover";
import { SaveToPanel } from "@/components/collections/SaveToPanel";

// Target can be:
// 1. Draft: { kind: "draft", save: useSavePrompt(...) }
// 2. Saved: { kind: "saved", promptId: string }
// 3. Community: { kind: "community", publicId: string }
<Popover
  open={open}
  onClose={() => setOpen(false)}
  anchorRef={buttonRef}
  label="Save to"
>
  <SaveToPanel
    target={{ kind: "saved", promptId }}
    onDone={() => setOpen(false)}
  />
</Popover>;
```

---

## 8. Glyph Debt Tracking

All newly created and touched files strictly use `Icon` or `Glyph` from `@/components/ui`.
Remaining legacy text glyph debt in the workspace and library will be recorded in the final delivery report.
