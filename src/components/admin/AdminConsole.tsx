"use client";

import { useCallback, useEffect, useState } from "react";
import { api, json } from "@/lib/client/api";
import AdminDashboard, {
  type Analytics,
  type Feedback,
  type Update,
} from "./AdminDashboard";
import AdminUpdateComposer, { type ReleaseForm } from "./AdminUpdateComposer";

const emptyForm: ReleaseForm = {
  id: "",
  version: "",
  date: "",
  title: "",
  summary: "",
  body: "",
};

export default function AdminConsole() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [form, setForm] = useState<ReleaseForm>(emptyForm);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [numbers, reports, news] = await Promise.all([
        api<{ analytics: Analytics }>("/api/admin/analytics"),
        api<{ feedback: Feedback[] }>("/api/admin/feedback"),
        api<{ updates: Update[] }>("/api/updates"),
      ]);
      setAnalytics(numbers.analytics);
      setFeedback(reports.feedback);
      setUpdates(news.updates);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load admin data.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await json("/api/admin/updates", "POST", form);
      setForm(emptyForm);
      setNotice("Update published.");
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not publish update.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (removeId !== id) {
      setRemoveId(id);
      return;
    }
    try {
      await api(`/api/admin/updates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setRemoveId("");
      setNotice("Update removed.");
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not remove update.",
      );
    }
  }

  return (
    <>
      <AdminDashboard
        analytics={analytics}
        feedback={feedback}
        updates={updates}
        form={form}
        onRemove={remove}
        confirmingRemoveId={removeId}
      >
        <AdminUpdateComposer
          form={form}
          update={(field, value) =>
            setForm((current) => ({ ...current, [field]: value }))
          }
          publish={publish}
          busy={busy}
          notice={notice}
        />
      </AdminDashboard>
    </>
  );
}
