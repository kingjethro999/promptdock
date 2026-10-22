"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnchorLink } from "@/components/scroll/AnchorLink";

type ModelEntry = {
  id: string;
  provider: string;
  logo: string;
  model: string;
  status: string;
  bestFor: string;
  inputs: string[];
  context: string;
  capabilities: string[];
  source: { label: string; href: string };
  benchmark: boolean;
};

type BenchmarkResult = {
  modelId: string;
  servedModels?: string[];
  attemptedCount: number;
  validResponseCount: number;
  responseRate: number | null;
  errorCount: number;
  errorBreakdown: Record<string, number>;
  truncatedCount: number;
  evaluatedCount: number;
  requirementCount: number;
  requirementCoverage: number | null;
  strictCompleteCount: number;
  strictCompleteRate: number | null;
  hardConstraintOmissions: number;
  unsupportedAdditionCount: number;
  averageLatencyMs: number | null;
  totalTokens: number;
  estimatedCostUsd: number | null;
};

type BenchmarkFixtureResult = {
  modelId: string;
  validResponse: boolean;
  truncated: boolean;
  errorStatus?: number | null;
  errorCode?: string | null;
  latencyMs: number | null;
  usage: { totalTokens: number | null };
  estimatedCostUsd: number | null;
  reviewStatus: string;
  scoring: { requirementCoverage: number; passed: boolean } | null;
};

type BenchmarkReport = {
  generatedAt?: string;
  configuration?: {
    maxTokens: number | null;
    timeoutMs: number | null;
    fixtureCount: number | null;
    modelCount: number | null;
    nvidiaThinkingEnabled: boolean | null;
  };
  models?: BenchmarkResult[];
  results?: BenchmarkFixtureResult[];
};

const models: ModelEntry[] = [
  {
    id: "nvidia-super-vl",
    provider: "NVIDIA",
    logo: "/images/providers/nvidia.svg",
    model: "Nemotron 3.5 Super VL 120B-A12B",
    status: "PromptDock preferred model",
    bestFor: "Detailed instructions, coding tasks, and visual references",
    inputs: ["Text", "Images", "Video"],
    context: "262K hosted model card",
    capabilities: ["Reasoning", "Structured output", "Tool use", "Streaming"],
    source: {
      label: "NVIDIA model card",
      href: "https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b/modelcard",
    },
    benchmark: true,
  },
  {
    id: "nvidia-lightning",
    provider: "NVIDIA",
    logo: "/images/providers/nvidia.svg",
    model: "Nemotron 3.5 Lightning 30B-A3B",
    status: "Available through NVIDIA BYOK",
    bestFor: "Fast text refinement and a benchmark comparison candidate",
    inputs: ["Text"],
    context: "Up to 1M model context (deployment dependent)",
    capabilities: ["Reasoning", "Structured output"],
    source: {
      label: "NVIDIA model card",
      href: "https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/modelcard",
    },
    benchmark: true,
  },
  {
    id: "nvidia-super-text",
    provider: "NVIDIA",
    logo: "/images/providers/nvidia.svg",
    model: "Nemotron 3 Super 120B-A12B",
    status: "Available through NVIDIA BYOK",
    bestFor: "An additional reasoning baseline for evaluation",
    inputs: ["Text"],
    context: "Up to 1M model context (deployment dependent)",
    capabilities: ["Reasoning", "Tool use"],
    source: {
      label: "NVIDIA model card",
      href: "https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b/modelcard",
    },
    benchmark: true,
  },
  {
    id: "nvidia-ultra-text",
    provider: "NVIDIA",
    logo: "/images/providers/nvidia.svg",
    model: "Nemotron 3 Ultra 550B-A55B",
    status: "Available through NVIDIA BYOK",
    bestFor: "Complex reasoning and planning; benchmark candidate",
    inputs: ["Text"],
    context: "Up to 1M model context (deployment dependent)",
    capabilities: ["Reasoning", "Tool use"],
    source: {
      label: "NVIDIA model card",
      href: "https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard",
    },
    benchmark: true,
  },
  {
    id: "groq-gpt-oss",
    provider: "Groq",
    logo: "/images/providers/groq.svg",
    model: "GPT-OSS 120B",
    status: "System fallback and BYOK",
    bestFor: "Fast text generation and an independent provider baseline",
    inputs: ["Text"],
    context: "131,072 tokens",
    capabilities: ["Reasoning", "Tool use", "JSON schema"],
    source: {
      label: "Groq model card",
      href: "https://console.groq.com/docs/model/openai/gpt-oss-120b",
    },
    benchmark: true,
  },
  {
    id: "gemini-flash",
    provider: "Google Gemini",
    logo: "/images/providers/google-gemini.svg",
    model: "Gemini 2.5 Flash",
    status: "System fallback and BYOK",
    bestFor: "Multimodal prompts and fast, high-volume refinement",
    inputs: ["Text", "Images", "Video", "Audio"],
    context: "1,048,576 input tokens",
    capabilities: ["Thinking", "Structured output", "Function calling"],
    source: {
      label: "Gemini model card",
      href: "https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash",
    },
    benchmark: false,
  },
  {
    id: "apmix",
    provider: "APMIX",
    logo: "/images/providers/apmix.png",
    model: "Free model available to your APMIX key",
    status: "System fallback and BYOK",
    bestFor: "Using the model currently available in your APMIX account",
    inputs: ["Depends on selected model"],
    context: "Depends on selected model and plan",
    capabilities: ["Model catalog can change by account"],
    source: { label: "APMIX model catalog", href: "https://apmix.ai/models" },
    benchmark: false,
  },
  {
    id: "openai",
    provider: "OpenAI",
    logo: "/images/providers/openai.svg",
    model: "Choose a model with your OpenAI key",
    status: "Bring your own key",
    bestFor: "Users who want to select their OpenAI model in Settings",
    inputs: ["Depends on selected model"],
    context: "Depends on selected model",
    capabilities: ["Model ID chosen in Settings"],
    source: {
      label: "OpenAI model catalog",
      href: "https://platform.openai.com/docs/models",
    },
    benchmark: false,
  },
  {
    id: "anthropic",
    provider: "Anthropic",
    logo: "/images/providers/anthropic.svg",
    model: "Choose a model with your Anthropic key",
    status: "Bring your own key",
    bestFor: "Users who want to select their Claude model in Settings",
    inputs: ["Depends on selected model"],
    context: "Depends on selected model",
    capabilities: ["Model ID chosen in Settings"],
    source: {
      label: "Anthropic model overview",
      href: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
    },
    benchmark: false,
  },
  {
    id: "compatible",
    provider: "Compatible APIs",
    logo: "",
    model: "OpenAI-compatible or Anthropic-compatible endpoint",
    status: "Bring your own endpoint",
    bestFor: "Connecting another provider and model ID in Settings",
    inputs: ["Depends on provider"],
    context: "Depends on provider and model",
    capabilities: ["HTTPS endpoint", "Model ID chosen in Settings"],
    source: {
      label: "Provider setup guide",
      href: "https://github.com/kingjethro999/promptdock#ai-providers",
    },
    benchmark: false,
  },
];

const filters = [
  "All providers",
  "NVIDIA",
  "Groq",
  "Google Gemini",
  "APMIX",
  "OpenAI",
  "Anthropic",
  "Compatible APIs",
];
const benchmarkModels = [
  {
    id: "nvidia-super-vl",
    name: "Nemotron 3.5 Super VL",
    logo: "/images/providers/nvidia.svg",
  },
  {
    id: "nvidia-lightning",
    name: "Nemotron 3.5 Lightning",
    logo: "/images/providers/nvidia.svg",
  },
  {
    id: "nvidia-super-text",
    name: "Nemotron 3 Super",
    logo: "/images/providers/nvidia.svg",
  },
  {
    id: "nvidia-ultra-text",
    name: "Nemotron 3 Ultra",
    logo: "/images/providers/nvidia.svg",
  },
  {
    id: "groq-gpt-oss-120b",
    name: "GPT-OSS 120B",
    logo: "/images/providers/groq.svg",
  },
];
const benchmarkChecks = [
  {
    key: "availability",
    name: "Valid response rate",
    description:
      "Separates completed responses from provider errors and truncation",
  },
  {
    key: "coverage",
    name: "Requirement coverage",
    description: "Evidence-reviewed coverage; partial criteria count as half",
  },
  {
    key: "strict",
    name: "Strict complete rate",
    description:
      "Reviewed outputs preserving every criterion with no unsupported additions",
  },
  {
    key: "omissions",
    name: "Hard constraint omissions",
    description:
      "Uncovered prohibitions and required decisions across reviewed outputs",
  },
  {
    key: "additions",
    name: "Unsupported additions",
    description: "Flags details that were not supplied by the user",
  },
  {
    key: "completion",
    name: "Completion and truncation",
    description: "Checks valid responses and provider finish reason",
  },
  {
    key: "performance",
    name: "Latency and token usage",
    description: "Records time and provider-reported usage",
  },
  {
    key: "cost",
    name: "Estimated provider cost",
    description: "Calculated only when token prices are configured",
  },
];

function ProviderMark({ model }: { model: ModelEntry }) {
  if (!model.logo)
    return (
      <span className="model-provider-monogram" aria-hidden="true">
        API
      </span>
    );
  return (
    <span className={`model-provider-mark model-provider-mark-${model.id}`}>
      <Image src={model.logo} alt="" width={34} height={34} />
    </span>
  );
}

export default function ModelsBenchmark() {
  const [view, setView] = useState<"models" | "benchmark">("models");
  const [provider, setProvider] = useState("All providers");
  const [benchmark, setBenchmark] = useState<BenchmarkReport>({});
  useEffect(() => {
    fetch("/model-benchmark.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((report: BenchmarkReport | null) => {
        if (report && Array.isArray(report.results)) setBenchmark(report);
      })
      .catch(() => {});
  }, []);
  const visibleModels = useMemo(
    () =>
      models.filter(
        (model) => provider === "All providers" || model.provider === provider,
      ),
    [provider],
  );

  return (
    <section
      className="landing-models"
      id="models"
      aria-labelledby="modelsHeading"
    >
      <div className="landing-models-shell">
        <div className="landing-models-intro">
          <span className="landing-kicker">MODEL DIRECTORY</span>
          <h2 id="modelsHeading">Various models to choose from.</h2>
          <p>
            Start with PromptDock’s preferred model, bring your own provider
            key, or connect a compatible API. Capabilities depend on the model
            and your provider account.
          </p>
        </div>

        <div className="models-toolbar">
          <div
            className="models-tabs"
            role="tablist"
            aria-label="Model directory views"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "models"}
              onClick={() => setView("models")}
            >
              Models
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "benchmark"}
              onClick={() => setView("benchmark")}
            >
              Benchmark
            </button>
          </div>
          {view === "models" && (
            <label className="models-filter">
              <span>Provider</span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                {filters.map((filter) => (
                  <option value={filter} key={filter}>
                    {filter}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {view === "models" ? (
          <div
            className="models-table-wrap"
            role="tabpanel"
            aria-label="Available models"
          >
            <table className="models-table">
              <thead>
                <tr>
                  <th scope="col">Provider / model</th>
                  <th scope="col">Good for</th>
                  <th scope="col">Input</th>
                  <th scope="col">Context</th>
                  <th scope="col">Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {visibleModels.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <div className="models-name-cell">
                        <ProviderMark model={model} />
                        <div>
                          <strong>{model.provider}</strong>
                          <span>{model.model}</span>
                          <small>{model.status}</small>
                        </div>
                      </div>
                    </td>
                    <td>{model.bestFor}</td>
                    <td>{model.inputs.join(", ")}</td>
                    <td>{model.context}</td>
                    <td>
                      <div className="model-capabilities">
                        {model.capabilities.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                        <a
                          href={model.source.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {model.source.label}
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="models-directory-note">
              Context and feature details come from provider documentation. The
              actual limit can vary by endpoint, account, model version, and
              available quota.
            </p>
          </div>
        ) : (
          <div
            className="models-benchmark"
            role="tabpanel"
            aria-label="PromptDock model benchmark"
          >
            <div className="models-benchmark-heading">
              <div>
                <span className="model-benchmark-status">
                  PromptDock evaluation
                </span>
                <h3>Measured on the same preservation tasks.</h3>
                <p>
                  Reliability counts completed responses. Coverage and strict
                  completion use only evidence-reviewed outputs.
                </p>
              </div>
              <span className="model-benchmark-pending">
                {benchmark.generatedAt
                  ? `Last evaluated ${new Date(benchmark.generatedAt).toLocaleDateString()}`
                  : "First run pending"}
              </span>
            </div>
            <div className="models-table-wrap">
              <table className="benchmark-table">
                <thead>
                  <tr>
                    <th scope="col">Evaluation</th>
                    <th scope="col">What it measures</th>
                    {benchmarkModels.map((model) => {
                      const result = (benchmark.models || []).find(
                        (candidate) => candidate.modelId === model.id,
                      );
                      return (
                        <th scope="col" key={model.name}>
                          <span className="benchmark-model-heading">
                            <Image
                              src={model.logo}
                              alt=""
                              width={20}
                              height={20}
                            />
                            {model.name}
                          </span>
                          {result?.servedModels?.length ? (
                            <span className="benchmark-served-model">
                              Provider returned:{" "}
                              {result.servedModels.join(", ")}
                            </span>
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {benchmarkChecks.map(({ key, name, description }) => (
                    <tr key={key}>
                      <th scope="row">
                        <strong>{name}</strong>
                      </th>
                      <td className="benchmark-measure-description">
                        {description}
                      </td>
                      {benchmarkModels.map((model) => {
                        const result = (benchmark.models || []).find(
                          (candidate) => candidate.modelId === model.id,
                        );
                        return (
                          <td key={`${key}-${model.name}`}>
                            <span
                              className={
                                result
                                  ? "benchmark-result-value"
                                  : "benchmark-not-run"
                              }
                            >
                              {benchmarkValue(key, result)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="models-directory-note">
              {benchmark.configuration?.maxTokens
                ? `Run settings: ${benchmark.configuration.maxTokens.toLocaleString()} output tokens and ${Math.round((benchmark.configuration.timeoutMs || 0) / 1000)} seconds per request. `
                : "Run settings are not available. "}
              Requirement coverage averages covered criteria as 1, partial as
              0.5, and missing as 0 across reviewed outputs. Provider errors and
              truncated responses are excluded from quality scores. Each
              response was reviewed against the fixture rubric; the sample is
              four requests per model. Costs appear only when token prices are
              configured. NVIDIA extended reasoning was disabled for this
              comparison. Provider-reported model identifiers appear under each
              candidate when available. Models without a published run remain
              marked as not measured.
            </p>
          </div>
        )}

        <div className="models-footer">
          <span>
            Provider identities are shown for reference. PromptDock is
            independent.
          </span>
          <AnchorLink href="#your-keys">Connect your own provider</AnchorLink>
        </div>
      </div>
    </section>
  );
}

function benchmarkValue(key: string, result?: BenchmarkResult) {
  if (!result) return "Not measured";
  if (key === "availability")
    return `${result.validResponseCount}/${result.attemptedCount} valid · ${
      Object.entries(result.errorBreakdown || {})
        .map(([name, count]) => `${count} ${name}`)
        .join(", ") || "0 errors"
    } · ${result.truncatedCount} truncated`;
  if (key === "coverage")
    return result.requirementCoverage == null
      ? `Not reviewed · ${result.validResponseCount} valid`
      : `${(result.requirementCoverage * 100).toFixed(1)}% · ${result.requirementCount} criteria`;
  if (key === "strict")
    return result.strictCompleteRate == null
      ? `Not reviewed · 0/${result.validResponseCount} outputs`
      : `${(result.strictCompleteRate * 100).toFixed(1)}% · ${result.strictCompleteCount}/${result.evaluatedCount} outputs`;
  if (key === "omissions")
    return result.evaluatedCount
      ? `${result.hardConstraintOmissions} · ${result.evaluatedCount} reviewed`
      : "Not reviewed";
  if (key === "additions")
    return result.evaluatedCount
      ? `${result.unsupportedAdditionCount} · ${result.evaluatedCount} reviewed`
      : "Not reviewed";
  if (key === "performance")
    return `${result.averageLatencyMs == null ? "—" : `${result.averageLatencyMs.toLocaleString()} ms avg.`} · ${result.totalTokens.toLocaleString()} tokens`;
  if (key === "cost")
    return result.estimatedCostUsd == null
      ? "Not reported"
      : `$${result.estimatedCostUsd.toFixed(4)} total`;
  return "Not measured";
}
