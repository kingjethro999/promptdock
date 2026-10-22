# PromptDock Model Benchmark Redesign

## Goal

Publish a readable, honest comparison of PromptDock's prompt-refinement models, with consistent fixture coverage, explicit response reliability, and requirement-preservation scores that do not mistake paraphrases for omissions.

## User and product context

The landing-page benchmark is intended to help users compare AI providers and models available in PromptDock. The current table is difficult to read because pale brand-yellow text is used for small results on a light background. Its `0/4 passed` wording conflates a valid model response with a response that passed every strict requirement check. The current scorer relies on literal anchor phrases, which can mark semantically correct paraphrases as missing.

The benchmark should compare the four previously discussed NVIDIA text-generation candidates—Nemotron 3.5 Super VL, Nemotron 3.5 Lightning, Nemotron 3 Super 120B-A12B, Nemotron 3 Ultra 550B-A55B—with Groq GPT-OSS 120B. Provider/model errors must remain distinct from quality scores. Other providers may remain listed as user-selectable models, but are outside this live benchmark until corresponding credentials and a comparable setup are available.

## Design

### Candidate selection and execution

Use the existing four deterministic prompt-refinement fixtures for each candidate, under the same system policy and generation settings wherever the API supports them. Query NVIDIA's current model catalog before running and use the model IDs currently exposed by the configured endpoint. Treat failed requests, invalid responses, truncations, and quota/authentication errors as availability outcomes, not zero-quality generations. Never expose API keys, full prompts, or raw generated text in the public report.

### Evaluation and scoring

Replace exact-phrase-only anchors as the public quality measure with a documented requirement rubric per fixture. Score each source requirement as covered, partial, or missing, with an evidence excerpt from the generated response in local retained benchmark artifacts. Count explicit hard-constraint omissions and unsupported additions separately. Keep fixture-level scores so aggregate means are auditable. Public reports contain only aggregate metrics and safe diagnostic categories.

Report at least:

- Valid response rate: non-empty, parseable, and not provider-reported truncated responses divided by attempted fixtures.
- Requirement coverage: weighted covered/partial/missing rubric score among valid responses, with sample count.
- Strict complete rate: valid responses with all rubric requirements covered and no unsupported additions, clearly separate from response rate.
- Hard-constraint omissions and unsupported additions, as counts over the valid evaluated outputs.
- Mean latency, token usage, and cost only when configured prices and provider usage are available.

Scoring must not silently treat a provider error as a valid low-quality response, or an incomplete response as a successful completion. Results must include per-model attempt/valid/evaluated counts; unavailable or untested models must not be presented as measured.

### Landing-page presentation

Retain the existing benchmark table and provider logos. Use accessible, high-contrast text for all result values; reserve bright yellow for accents that do not carry essential information. Rename completion metrics to make availability explicit, distinguish coverage from strict completion, show sample size and report timestamp, and label errors separately from quality. Keep the full table usable on narrow screens via its existing horizontal-scroll behavior.

Include all five benchmark candidates as columns. Keep broader provider/model selection information in the model catalog section; a model not included in this live evaluation remains explicitly unmeasured rather than being given fabricated scores.

### Validation and publication

Add deterministic unit tests for rubric scoring, response-rate aggregation, error classification, and public-report sanitization. Run the benchmark against all five candidates using the provided server-side keys and retain raw outputs only in ignored local artifacts. Review rubric scoring against actual outputs before publishing. Run the existing test, lint, format, type-check, and production-build checks, then visually inspect the landing benchmark.

## Constraints

- Preserve existing model/provider integrations and benchmark credentials; never print or publish secrets.
- Do not use external model leaderboard results as if they were PromptDock test results.
- Do not claim semantic evaluation certainty beyond the fixture rubric and reviewed evidence.
- Do not count provider errors as low-quality output.
- Do not publish raw prompts, completions, or sensitive benchmark artifacts.
- Limit this change to benchmark methodology, its landing-page display, and tests required to verify them.

## Acceptance criteria

1. Five candidates are configured and measured against the same four fixtures where provider capabilities permit.
2. The report distinguishes attempts, valid responses, quality coverage, strict completion, truncation, and provider errors.
3. Groq's prior `0/4` display cannot imply request failure when it returned valid responses.
4. Semantic paraphrases are not rejected solely for differing from fixture wording; each score is traceable to a rubric requirement and local evidence.
5. The landing table uses readable contrast and presents the new measures, sample sizes, errors, and report date clearly.
6. Automated checks pass, and no secret or raw completion is included in the published JSON.
