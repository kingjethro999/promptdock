"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { api } from "@/lib/client/api";

export default function ShareActions({
  prompt,
  publicId,
}: {
  prompt: string;
  publicId: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice("Prompt copied.");
    } catch {
      setNotice("Copy unavailable. Select the prompt text and copy it.");
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/public/prompts/${publicId}/fork`, { method: "POST" });
      router.push("/library");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 401
      ) {
        router.push(
          `/auth?mode=register&next=${encodeURIComponent(`/p/${publicId}`)}`,
        );
      } else
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not save this prompt.",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shared-actions">
      <Button
        className="shared-copy"
        variant="secondary"
        leadingIcon="copy"
        trailingIcon="arrow-up-right"
        onClick={copy}
      >
        Copy prompt
      </Button>
      <Button
        className="shared-save"
        variant="primary"
        leadingIcon="bookmark"
        disabled={busy}
        loading={busy}
        onClick={save}
      >
        Save to my library
      </Button>
      {notice && (
        <p role="status" className="shared-feedback">
          {notice}
        </p>
      )}
    </div>
  );
}
