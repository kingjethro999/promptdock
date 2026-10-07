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
  imageSupported: boolean;
  baseUrl: string;
  active: boolean;
};
type Settings = {
  available: boolean;
  providers: Provider[];
  activeProviderId: string | null;
};
const providerTypes = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "apmix", label: "APMIX" },
  { value: "anthropic_compatible", label: "Anthropic Compatible" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "gemini", label: "Gemini" },
];

export default function AiProviderSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("groq");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
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
        { name, provider: type, baseUrl, model, apiKey: key },
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
        Save Anthropic, OpenAI, Groq, APMIX, Gemini, or a compatible custom
        endpoint, then choose which one is active. Keys stay encrypted on the
        server and are never returned to your browser.
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
        describedBy={
          selected &&
          !settings?.providers.find(
            (provider) => provider.providerId === selected,
          )?.imageSupported
            ? "provider-image-warning"
            : undefined
        }
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
      {selected &&
        settings?.providers.find((provider) => provider.providerId === selected)
          ?.imageSupported === false && (
          <p
            id="provider-image-warning"
            role="status"
            className="react-provider-image-warning"
          >
            This model doesn’t support images. PromptDock’s default vision
            provider will handle attached images.
          </p>
        )}
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
      <form onSubmit={save} autoComplete="off">
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
        {(type === "openai_compatible" || type === "anthropic_compatible") && (
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
          <span>API key {editing && "(leave blank to keep saved key)"}</span>
          <span className="react-password-field">
            <input
              required={!editing}
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="new-password"
              name="provider-secret-key"
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
