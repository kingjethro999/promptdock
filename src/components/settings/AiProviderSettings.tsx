"use client";

import { useEffect, useState } from "react";
import SearchSelect from "@/components/ui/SearchSelect";
import Button from "@/components/ui/Button";
import { api, json } from "@/lib/client/api";

type Provider = {
  providerId: string;
  name: string;
  provider: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  active: boolean;
};
type Settings = {
  available: boolean;
  providers: Provider[];
  activeProviderId: string | null;
};
const providerTypes = [
  { value: "groq", label: "Groq" },
  { value: "gemini", label: "Gemini" },
  { value: "apmix", label: "APMIX" },
  { value: "openai", label: "OpenAI compatible" },
  { value: "anthropic", label: "Anthropic compatible" },
];

export default function AiProviderSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("groq");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((value) => {
        setSettings(value);
        setSelected(value.activeProviderId || "");
      })
      .catch((error) => setNotice(error.message));
  }, []);

  function edit(provider?: Provider) {
    setEditing(provider?.providerId || "");
    setName(provider?.name || "");
    setType(provider?.provider || "groq");
    setBaseUrl(provider?.baseUrl || "");
    setModel(provider?.model || "");
    setVisionModel(provider?.visionModel || "");
    setKey("");
    setNotice("");
  }

  async function activate(value: string) {
    if (!settings || busy) return;
    setBusy(true);
    try {
      const result = await json<Settings>("/api/settings/active", "POST", {
        providerId: value || null,
      });
      setSettings(result);
      setSelected(result.activeProviderId || "");
      setNotice(
        value ? "Active provider changed." : "Using PromptDock default.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not change provider.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await json<Settings>(
        editing
          ? `/api/settings/providers/${editing}`
          : "/api/settings/providers",
        editing ? "PUT" : "POST",
        { name, provider: type, baseUrl, model, visionModel, apiKey: key },
      );
      setSettings(result);
      setSelected(result.activeProviderId || "");
      setKey("");
      setNotice("Provider saved and selected.");
      const active = result.providers.find((provider) => provider.active);
      if (active) edit(active);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save provider.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const result = await api<Settings>(`/api/settings/providers/${editing}`, {
        method: "DELETE",
      });
      setSettings(result);
      setSelected(result.activeProviderId || "");
      edit();
      setNotice("Provider removed.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not remove provider.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card react-settings-card">
      <span className="section-kicker">AI PROVIDER</span>
      <h2>Bring your own key</h2>
      <p>
        Save as many providers as you like — Groq, Gemini, APMIX, or a custom
        OpenAI- or Anthropic-compatible endpoint — then pick which one is
        active. Keys stay encrypted on the server and are never returned to your
        browser.
      </p>
      {settings?.available && (
        <p className="react-provider-status">
          {settings.providers.find(
            (provider) => provider.providerId === selected,
          )?.name || "Using PromptDock’s configured provider."}
        </p>
      )}
      {!settings && !notice && (
        <p className="react-provider-status">Checking your settings…</p>
      )}
      {settings && !settings.available && (
        <p role="status" className="settings-feedback">
          Bring your own key is unavailable until the server encryption key is
          configured.
        </p>
      )}
      <SearchSelect
        label="Active provider"
        value={selected}
        options={[
          { value: "", label: "PromptDock default" },
          ...(settings?.providers || []).map((provider) => ({
            value: provider.providerId,
            label: provider.name,
          })),
        ]}
        searchable
        onChange={activate}
      />
      {Boolean(settings?.providers.length) && (
        <div className="react-provider-list">
          {settings?.providers.map((provider) => (
            <button
              type="button"
              className={editing === provider.providerId ? "selected" : ""}
              key={provider.providerId}
              onClick={() => edit(provider)}
            >
              {provider.name}
              {provider.active ? " · active" : ""}
            </button>
          ))}
        </div>
      )}
      <div className="settings-actions react-provider-actions">
        <Button onClick={() => edit()}>Add a provider</Button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => void activate("")}
        >
          Use PromptDock default
        </button>
      </div>
      <form onSubmit={save}>
        <label className="react-field">
          <span>Name</span>
          <input
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Work Groq"
          />
        </label>
        <SearchSelect
          label="Provider type"
          value={type}
          options={providerTypes}
          searchable
          onChange={setType}
        />
        {(type === "openai" || type === "anthropic") && (
          <label className="react-field">
            <span>Base URL</span>
            <input
              required
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://your-provider.example/v1"
            />
          </label>
        )}
        <label className="react-field">
          <span>Model ID</span>
          <input
            required
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="e.g. openai/gpt-oss-120b"
          />
        </label>
        <label className="react-field">
          <span>
            Image model ID <em className="react-field-optional">optional</em>
          </span>
          <input
            value={visionModel}
            onChange={(event) => setVisionModel(event.target.value)}
            placeholder="Used automatically when images are attached"
          />
          <small>
            Groq switches to a vision model automatically. For APMIX or a custom
            OpenAI endpoint, enter a vision-capable model here, even if it is
            the same as the text model.
          </small>
        </label>
        <label className="react-field">
          <span>API key {editing && "(leave blank to keep saved key)"}</span>
          <span className="react-password-field">
            <input
              required={!editing}
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowKey(!showKey)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </span>
          <small>
            Leave this empty to keep your saved key when changing the model.
          </small>
        </label>
        <div className="react-modal-actions">
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !settings?.available}
          >
            {busy ? "Saving…" : editing ? "Save provider" : "Add provider"}
          </Button>
          {editing && (
            <Button disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
      </form>
      {notice && (
        <p role="status" className="settings-feedback">
          {notice}
        </p>
      )}
    </section>
  );
}
