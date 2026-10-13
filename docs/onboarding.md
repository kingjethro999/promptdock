# Onboarding & Guided Workspace Tour System

## Audit & Existing Platform Findings

| Capability | Exists? (File) | Decision | Reason |
|---|---|---|---|
| Updates changelog | Yes (`src/updates.js`, `src/app/updates/`) | **Reuse** | Existing updates system already lists product releases and changelog entries. |
| Unread indicator & tracking | Yes (`src/components/workspace/UpdatesBell.tsx`) | **Reuse & Extend** | Already maintains server-synced read IDs. We added tab-inactive check (`document.hidden`) to stop unnecessary background polling. |
| Walkthrough spotlight & tour engine | No | **Build New** | Missing guided walkthrough experience for fresh accounts and key feature releases. |
| User experience persistence | No | **Build New** (`user_experiences` table) | Distinct from changelog read-state: tracks whether a user completed or skipped guided walkthroughs. |
| UI Kit primitives | Yes (`src/components/ui/`) | **Reuse** | Reuses `Button`, `IconButton`, `Icon`, `AppDialog`, and motion tokens. |

## Registry & Target IDs

Experiences live in code at `src/lib/onboarding/registry.ts`:

- `welcome-v1` (Welcome tour, priority 100):
  - Step 1: `hello` (modal) - Intro to PromptDock idea-to-prompt transformation.
  - Step 2: `composer` (spotlight, target `composer`) - Points to prompt idea input.
  - Step 3: `library` (spotlight, target `nav-library`) - Points to user saved prompts.
  - Step 4: `community` (spotlight, target `nav-community`) - Points to community exploration.
  - Step 5: `keys` (spotlight, target `nav-settings`) - Points to personal AI provider keys.
- `release-2026-10-community` (Release announcement, priority 50):
  - Step 1: `intro` (modal) - Announcement of Community feature.
  - Step 2: `sidebar` (spotlight, target `nav-community`) - Points to sidebar entry.
  - Step 3: `profile` (modal) - Points to public profile with custom CTA to profile settings.

## Eligibility & Orchestration Rules

- **Pure Evaluation on Server:** During workspace layout rendering, `pickPending({ createdAt }, rows)` evaluates pending experiences in a single database query.
- **Audience Segmentation:**
  - Users created on or after `ONBOARDING_EPOCH` (`2026-10-12T00:00:00Z`) receive the `welcome-v1` tour.
  - Users created before `ONBOARDING_EPOCH` receive the `release-2026-10-community` announcement.
- **One at a Time & Cooldown:** At most one automatic experience is triggered per session, with a 24-hour cooldown between release announcements. Welcome tours ignore cooldown.
- **Quiet App Check (`isQuiet`):** The tour will only open when:
  - Tab is active and visible (`document.visibilityState === "visible"`).
  - No modal dialogs or popovers are open (`[role="dialog"][aria-modal="true"]`, `.updates-popover`, `.app-dialog`).
  - No active URL intent (`?remix=` or `?intent=`).
  - Tries up to 3 times with 2-second delay before backing off.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS user_experiences (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  text NOT NULL CHECK (char_length(experience_id) <= 80),
  status         text NOT NULL CHECK (status IN ('shown','completed','skipped','dismissed')),
  step_reached   smallint NOT NULL DEFAULT 0 CHECK (step_reached BETWEEN 0 AND 20),
  first_shown_at timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, experience_id)
);
CREATE INDEX IF NOT EXISTS user_experiences_recent_idx ON user_experiences (user_id, first_shown_at DESC);
```

## First-Party Analytics Queries

```sql
-- Welcome tour completion funnel
SELECT status, count(*) 
FROM user_experiences 
WHERE experience_id = 'welcome-v1' 
GROUP BY status;

-- Drop-off point by step
SELECT step_reached, count(*) 
FROM user_experiences 
WHERE experience_id = 'welcome-v1' 
  AND status IN ('skipped','dismissed') 
GROUP BY step_reached 
ORDER BY step_reached;

-- Release announcement impressions vs completions
SELECT experience_id, 
       count(*) AS shown, 
       count(*) FILTER (WHERE status = 'completed') AS completed 
FROM user_experiences 
GROUP BY experience_id;
```

## Authoring a New Announcement

1. Add `data-tour="feature-target"` to the target element in JSX.
2. In `src/lib/onboarding/registry.ts`, add an `Experience` object with `type: "release"`, a unique stable ID, and `publishedAt` set to deploy date.
3. Keep titles <= 48 characters, bodies <= 160 characters, with 2–3 steps max.
4. Run `node --test test/onboarding.test.js` to verify registry constraints and target presence.
