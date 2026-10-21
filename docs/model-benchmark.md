# PromptDock model fidelity benchmark

The public model directory at `/#models` lists provider capabilities and exposes the latest published PromptDock benchmark. It leaves scores marked as not measured until a live run is published.

The local benchmark compares Nemotron 3.5 Super VL, Nemotron 3.5 Lightning, the older Nemotron 3 Super text model when configured, and Groq GPT-OSS 120B. Every candidate receives the same preservation policy, fixture, and requested output budget. Fixtures cover short ideas, contradictory decisions, strict constraints, and a detailed AGENTS-style workspace specification. Scoring uses human-authored requirement anchors, hard-constraint omissions, and unsupported additions; reports also contain completion reason, truncation status, latency, and provider-reported token usage.

Set provider keys in a local, untracked environment and run:

```sh
NVIDIA_API_KEY=... GROQ_API_KEY=... npm run benchmark:models -- --publish
```

The script refuses to run when `CI` is set. Results are written to ignored `benchmark-results/` JSON and Markdown files. With `--publish`, it also updates `public/model-benchmark.json` with a sanitized score summary consumed by the landing page. That public file contains aggregate metrics only; it excludes API keys, prompt text, output text, and output hashes. Benchmark only controlled fixtures.

Optional settings:

- `AI_BENCHMARK_MAX_TOKENS` sets an equal completion budget for each candidate (default 16,384; accepted range 1–131,072).
- `AI_BENCHMARK_TIMEOUT_MS` sets the request timeout (default 180,000 ms).
- `AI_BENCHMARK_<MODEL>_INPUT_USD_PER_MILLION` and `AI_BENCHMARK_<MODEL>_OUTPUT_USD_PER_MILLION` enable per-model cost estimates. Replace `<MODEL>` with `NVIDIA_SUPER_VL`, `NVIDIA_LIGHTNING`, `NVIDIA_SUPER_TEXT`, or `GROQ_GPT_OSS_120B` and use the provider's applicable published prices.
- `BENCHMARK_NVIDIA_SUPER_MODEL` adds an older Nemotron 3 Super text candidate.
- `BENCHMARK_NVIDIA_SUPER_VL_MODEL`, `BENCHMARK_NVIDIA_LIGHTNING_MODEL`, and `BENCHMARK_GROQ_MODEL` override candidate IDs.
- `NVIDIA_BASE_URL` and `GROQ_BASE_URL` override provider base URLs for compatible deployments.

The requested output budget does not guarantee that an endpoint or account will allow it. A provider error or a `finish_reason` indicating length is recorded as invalid rather than scored as a complete answer. A benchmark run is a comparison aid; review fixture quality, account quotas, and provider conditions before changing production routing.

Provider capability details shown on the landing page are linked to provider documentation. The NVIDIA hosted model card currently advertises 262K context and text, image, and video input; NVIDIA's NIM deployment guide describes deployment configurations that can support larger contexts. Provider quotas and hosted limits can vary.
