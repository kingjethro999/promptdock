"use client";

export type ReleaseForm = {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  body: string;
};

type Props = {
  form: ReleaseForm;
  update(field: keyof ReleaseForm, value: string): void;
  publish(event: React.FormEvent<HTMLFormElement>): void;
  busy: boolean;
  notice: string;
};

export default function AdminUpdateComposer({
  form,
  update,
  publish,
  busy,
  notice,
}: Props) {
  const field = (
    key: keyof ReleaseForm,
    label: string,
    placeholder: string,
    maxLength?: number,
  ) => (
    <div className="admin-field">
      <label htmlFor={`update-${key}`}>{label}</label>
      {key === "summary" || key === "body" ? (
        <textarea
          id={`update-${key}`}
          required
          value={form[key]}
          rows={key === "body" ? 6 : 3}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <input
          id={`update-${key}`}
          required
          value={form[key]}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
      {key === "id" && <small>Use a unique lowercase slug.</small>}
    </div>
  );
  return (
    <section
      className="admin-panel admin-composer"
      id="publish"
      aria-labelledby="adminPublishHeading"
    >
      <div className="admin-panel-head">
        <span className="admin-panel-icon" aria-hidden="true">
          ✳
        </span>
        <div>
          <span className="admin-eyebrow">TELL YOUR USERS</span>
          <h2 id="adminPublishHeading">Publish an update</h2>
        </div>
      </div>
      <p className="admin-muted">
        A published update appears on the Updates page and reaches active users
        through live notifications.
      </p>
      <form onSubmit={publish}>
        <div className="admin-form-row">
          {field("id", "Update ID", "image-to-prompt")}
          {field("version", "Version", "v0.7.5")}
        </div>
        {field("date", "Date label", "October 3, 2026")}
        {field("title", "Headline", "What's new in PromptDock?", 140)}
        {field(
          "summary",
          "Short summary",
          "The message users see in their notification.",
          280,
        )}
        {field(
          "body",
          "Full update",
          "Share the details in your own words.",
          10000,
        )}
        <div className="admin-form-footer">
          <p className="admin-feedback" role="status">
            {notice}
          </p>
          <button className="admin-action" type="submit" disabled={busy}>
            {busy ? "Publishing…" : "Publish update"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
    </section>
  );
}
