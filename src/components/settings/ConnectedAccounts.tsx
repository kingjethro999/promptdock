"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { json } from "@/lib/client/api";
import {
  linkProvider,
  signInWithFirebaseCustomToken,
  type FirebaseProvider,
} from "@/lib/client/firebase";

const labels: Record<FirebaseProvider, string> = {
  google: "Google",
  github: "GitHub",
};

export default function ConnectedAccounts() {
  const [providers, setProviders] = useState<FirebaseProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<FirebaseProvider | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    json<{ providers: FirebaseProvider[] }>(
      "/api/auth/firebase/identities",
      "GET",
      undefined,
    )
      .then((result) => setProviders(result.providers))
      .catch((issue) =>
        setError(
          issue instanceof Error
            ? issue.message
            : "Could not load connected accounts.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function connect(provider: FirebaseProvider) {
    if (busy) return;
    setBusy(provider);
    setError("");
    try {
      const { customToken } = await json<{ customToken: string }>(
        "/api/auth/firebase/link/start",
        "POST",
        {},
      );
      await signInWithFirebaseCustomToken(customToken);
      const result = await linkProvider(provider);
      const idToken = await result.user.getIdToken(true);
      const linked = await json<{ providers: FirebaseProvider[] }>(
        "/api/auth/firebase/link/complete",
        "POST",
        { idToken, provider },
      );
      setProviders(linked.providers);
    } catch (issue) {
      const code = issue instanceof Error ? issue.message : "";
      setError(
        code.includes("credential-already-in-use")
          ? `This ${labels[provider]} account is already connected to another account.`
          : code || `Could not connect ${labels[provider]}.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="settings-connected-accounts">
      <strong>Connected accounts</strong>
      <p>
        Connect a provider after signing in so it can be used on future visits.
      </p>
      {(["google", "github"] as FirebaseProvider[]).map((provider) => {
        const connected = providers.includes(provider);
        return (
          <div className="settings-connected-row" key={provider}>
            <span>{labels[provider]}</span>
            <Button
              type="button"
              disabled={loading || connected || Boolean(busy)}
              onClick={() => connect(provider)}
            >
              {busy === provider
                ? "Connecting…"
                : connected
                  ? "Connected"
                  : "Connect"}
            </Button>
          </div>
        );
      })}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
