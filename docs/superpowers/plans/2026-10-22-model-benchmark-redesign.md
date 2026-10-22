# PromptDock Model Benchmark Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a readable and defensible PromptDock model comparison that separates provider availability from requirement-preservation quality.

**Architecture:** Extend the existing live benchmark runner with four NVIDIA generation candidates and Groq, four common fixtures, explicit request/response outcomes, and a fixture-rubric review record that retains evidence only in the ignored local report. Derive sanitized aggregate metrics for the landing-page table, keeping public report generation separate from raw completions and review evidence.

**Tech Stack:** Node.js CommonJS benchmark runner, JSON fixture/report data, TypeScript React landing component, shared CSS, Node test runner, Playwright coverage where available.

**Spec:** `docs/superpowers/specs/2026-10-22-model-benchmark-redesign-design.md`

## Global Constraints

- Keep NVIDIA/Groq credentials server-side and never print them.
- Do not publish raw prompts, completions, or per-requirement evidence.
- Provider errors and truncation are availability outcomes, not zero-quality completions.
- Do not present untested models as measured.
- Do not use external leaderboard values as PromptDock benchmark scores.
- Limit changes to benchmark methodology, its landing display, and related tests.

## Review Focus

- Provider returns HTTP error or rate limit: show an error outcome and exclude it from quality denominator.
- Provider returns empty or token-limited output: count it as invalid/truncated, not as a completed low-coverage result.
- Semantically equivalent wording differs from fixture phrases: score only against the documented fixture rubric and retain evidence locally.
- Model is unavailable in current NVIDIA catalog/account: show not measured/availability error without publishing a quality score.
- A public report is generated from retained local output: verify no completion, prompt, secret, or evidence excerpt enters the public JSON.

---

### Task 1: Expand and validate the live candidate matrix

**Files:**
- Modify: `scripts/model-benchmark.cjs`
- Test: `test/model-benchmark.test.js`

**Interfaces:**
- `buildModelMatrix(env)` returns NVIDIA Super VL, Lightning, Super 120B-A12B, Ultra 550B-A55B, and Groq GPT-OSS 120B in stable order, with provider-specific model overrides retained.

- [ ] Add failing tests asserting all five default candidates, stable IDs, and explicit key requirements.
- [ ] Add the Ultra model and make the previously optional Super model a default candidate; preserve environment overrides.
- [ ] Run `node --test test/model-benchmark.test.js` and confirm the new matrix assertions pass.
- [ ] Confirm current model IDs against NVIDIA's official catalog before live requests.

### Task 2: Separate availability from rubric quality

**Files:**
- Modify: `benchmark/fixtures/contradictory-decisions/fixture.json`
- Modify: `benchmark/fixtures/detailed-workspace/fixture.json`
- Modify: `benchmark/fixtures/short-idea/fixture.json`
- Modify: `benchmark/fixtures/strict-constraints/fixture.json`
- Modify: `scripts/model-benchmark.cjs`
- Test: `test/model-benchmark.test.js`

**Interfaces:**
- Each fixture defines stable criteria with an ID, a short meaning, a hard-constraint flag, and any known acceptable semantic phrasings as scorer aids rather than the sole definition of semantic correctness.
- A review record stores each criterion judgment as `covered`, `partial`, or `missing`, plus a short completion excerpt for local retained reports only.
- Aggregates expose `attemptedCount`, `validResponseCount`, and `evaluatedCount` separately; quality means are calculated over valid, reviewed outputs only.

- [ ] Add tests proving a valid Groq completion is counted as a valid response even when its strict-completion rate is below 100%.
- [ ] Add tests proving errors and truncation do not enter quality denominators, and semantic alternatives can cover a criterion.
- [ ] Implement report aggregation with separate response rate, weighted requirement coverage (covered = 1, partial = 0.5, missing = 0), strict complete rate, hard omissions, additions, latency, token usage, and optional cost.
- [ ] Preserve safe error categories/statuses while excluding provider error payload text and raw outputs from public reports.
- [ ] Test public JSON contains aggregate scores and safe error status only, never local evidence excerpts, prompts, or completions.

### Task 3: Correct the landing benchmark display

**Files:**
- Modify: `src/components/landing/ModelsBenchmark.tsx`
- Modify: `src/styles/shared/landing.css`
- Modify: `src/styles/next/landing-refresh.css`
- Test: relevant landing UI test in `test/` (add one if no current benchmark coverage exists)

**Interfaces:**
- The table reads the aggregate public report keyed by stable candidate ID and renders an explicit unmeasured state where no published reviewed score exists.

- [ ] Add the five candidate columns and update the report/result TypeScript types.
- [ ] Replace `passed/total passed` ambiguity with distinct response availability, requirement coverage, strict complete rate, omission/addition, performance, and cost values; show sample counts and report date.
- [ ] Update benchmark result and error styling to meet WCAG AA contrast for normal-size text while keeping yellow as a nonessential brand accent.
- [ ] Add or update rendered assertions for the Groq `valid responses` and quality rate distinction, the new models, and the unmeasured state.
- [ ] Run focused landing tests and inspect the benchmark visually at desktop and mobile widths.

### Task 4: Run, review, publish, and verify the five-model benchmark

**Files:**
- Modify: `public/model-benchmark.json`
- Local ignored outputs: `benchmark-results/` (never stage)

**Interfaces:**
- The live benchmark runner retains completions only in local ignored reports; a separately reviewed assessment supplies the criterion grades/evidence used to build the sanitized public report.

- [ ] Run all five candidates against all four fixtures with `--retain-output`, recording 20 attempts and not printing key values.
- [ ] Review each returned completion against its fixture criteria; mark covered/partial/missing with brief local evidence. Keep provider errors, empty responses, and truncation out of quality scoring.
- [ ] Verify the existing Groq 0/4 wording is removed and publish the measured 4/4 response availability independently from its actual reviewed quality score.
- [ ] Publish the sanitized report and verify its candidate coverage, sample counts, timestamp, error handling, and absence of prompt/completion/evidence fields.
- [ ] Run `npm run format`, `npm run ci:verify`, visually inspect the finished table, then `git add .`, commit, and push the authorized branch.

## Plan Self-Review

- Spec coverage: model candidates, shared fixtures, quality/reliability separation, semantic rubric evidence, public sanitization, high-contrast UI, error behavior, and CI verification are all assigned above.
- Step granularity: each task has one checkable deliverable and its own test/verification cycle.
- Interface consistency: stable IDs from Task 1 key the Task 2 report and Task 3 table; Task 4 consumes the report and assessment format.
- Review Focus: error, truncation, semantic phrasing, unavailable model, and report privacy each map to Task 2 tests; responsive/contrast checks map to Task 3.
- Scope: no provider integration or unrelated landing redesign is included.
