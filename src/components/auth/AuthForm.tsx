"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, json } from "@/lib/client/api";
import {
  firebaseConfigured,
  signInWithProvider,
  type FirebaseProvider,
} from "@/lib/client/firebase";
import { Button, LinkButton, TextField, PasswordField } from "@/components/ui";
import AuthShell from "./AuthShell";
import { useResendVerification } from "./useResendVerification";

type Mode = "login" | "register" | "forgot" | "reset";
const validModes = new Set<Mode>(["login", "register", "forgot", "reset"]);

export default function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const rawMode = params.get("mode") as Mode;
  const mode = validModes.has(rawMode) ? rawMode : "login";
  // A reset token is read once, then taken out of the address bar so it is
  // not left in history or shared by accident.
  const [token] = useState(() => params.get("token"));
  useEffect(() => {
    if (!params.get("token")) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [params]);
  const requestedNext = params.get("next") || "";
  const nextPage =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/workspace";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    params.get("verified") ? "Email verified. Sign in to continue." : "",
  );
  const [error, setError] = useState("");
  // Set once the server says this password account is waiting on its email,
  // or right after sign-up, so the resend action appears where it is needed.
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const resend = useResendVerification();
  const [usernameStatus, setUsernameStatus] = useState("");
  const [oauthBusy, setOauthBusy] = useState<FirebaseProvider | null>(null);

  function generatePassword() {
    const groups = [
      "ABCDEFGHJKLMNPQRSTUVWXYZ",
      "abcdefghijkmnopqrstuvwxyz",
      "23456789",
      "!@#$%^&*_-+=",
    ];
    const all = groups.join("");
    const values = new Uint32Array(18);
    crypto.getRandomValues(values);
    const chars = groups.map(
      (group, index) => group[values[index] % group.length],
    );
    for (let index = chars.length; index < values.length; index += 1)
      chars.push(all[values[index] % all.length]);
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swap = values[index] % (index + 1);
      [chars[index], chars[swap]] = [chars[swap], chars[index]];
    }
    const generated = chars.join("");
    setPassword(generated);
    setConfirm(generated);
  }

  async function continueWith(provider: FirebaseProvider) {
    if (oauthBusy || busy) return;
    setOauthBusy(provider);
    setError("");
    setNotice("");
    try {
      const credential = await signInWithProvider(provider);
      const idToken = await credential.user.getIdToken();
      await json("/api/auth/firebase", "POST", {
        idToken,
        referralCode:
          params.get("ref") ||
          sessionStorage.getItem("promptdock.referral") ||
          undefined,
      });
      router.replace(nextPage);
      router.refresh();
    } catch (issue) {
      const message =
        issue instanceof Error
          ? issue.message
          : `Could not sign in with ${provider === "google" ? "Google" : "GitHub"}.`;
      if (
        message.includes("auth/popup-closed-by-user") ||
        message.includes("cancelled")
      ) {
        setOauthBusy(null);
        return;
      }
      setError(message);
      setOauthBusy(null);
    }
  }

  useEffect(() => {
    if (mode !== "register" || !username.trim()) {
      setUsernameStatus("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ available?: boolean }>(
          `/api/auth/username-check?username=${encodeURIComponent(username.trim())}`,
        );
        if (!cancelled) {
          setUsernameStatus(
            res.available ? "Available" : "That handle is taken or reserved.",
          );
        }
      } catch {
        if (!cancelled) setUsernameStatus("");
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, username]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if ((mode === "register" || mode === "reset") && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setAwaitingVerification(false);
    try {
      if (mode === "login") {
        await json("/api/auth/login", "POST", { email, password });
        router.replace(nextPage);
        router.refresh();
      } else if (mode === "register") {
        await json("/api/auth/register", "POST", {
          email,
          username,
          password,
          referralCode:
            params.get("ref") ||
            sessionStorage.getItem("promptdock.referral") ||
            undefined,
        });
        setNotice(
          "Check your inbox for a verification link. Opening it signs you in.",
        );
        setAwaitingVerification(true);
      } else if (mode === "forgot") {
        await json("/api/auth/forgot", "POST", { email });
        setNotice("If the account exists, a reset link is on its way.");
      } else if (mode === "reset") {
        await json("/api/auth/reset", "POST", { token, password });
        setNotice("Password changed. Sign in with your new password.");
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not continue.");
      if (issue instanceof ApiError && issue.code === "verification_required")
        setAwaitingVerification(true);
    } finally {
      setBusy(false);
    }
  }

  const title = {
    login: "Sign in",
    register: "Create account",
    forgot: "Forgot password?",
    reset: "Reset password",
  }[mode];
  const loginHref = `/auth?mode=login&next=${encodeURIComponent(nextPage)}`;
  const registerHref = `/auth?mode=register&next=${encodeURIComponent(nextPage)}`;

  return (
    <AuthShell
      title={title}
      lead={
        mode === "register"
          ? "Create your account to save prompts on any device."
          : mode === "login"
            ? "Sign in to open your saved prompts on any device."
            : mode === "forgot"
              ? "We’ll send you a link to reset your password."
              : "Choose a new password for your account."
      }
    >
      <form onSubmit={submit} noValidate>
        {firebaseConfigured && (mode === "login" || mode === "register") && (
          <>
            <div className="auth-provider-actions">
              {(["google", "github"] as FirebaseProvider[]).map((provider) => (
                <Button
                  key={provider}
                  variant="secondary"
                  className="auth-provider-button"
                  disabled={busy || Boolean(oauthBusy)}
                  onClick={() => continueWith(provider)}
                >
                  <Image
                    className="auth-provider-icon"
                    src={`/assets/brands/${provider}.svg`}
                    alt=""
                    width={18}
                    height={18}
                    aria-hidden="true"
                  />
                  {oauthBusy === provider
                    ? "Connecting…"
                    : `Continue with ${provider === "google" ? "Google" : "GitHub"}`}
                </Button>
              ))}
            </div>
            <div className="auth-provider-divider">
              <span>or continue with email</span>
            </div>
          </>
        )}
        {mode !== "reset" && (
          <div className="auth-form-field">
            <TextField
              id="authEmail"
              label="Email"
              required
              type="email"
              maxLength={254}
              value={email}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}
        {mode === "register" && (
          <div className="auth-form-field">
            <TextField
              id="authUsername"
              label="Username"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9][A-Za-z0-9_]{2,23}"
              value={username}
              autoComplete="username"
              placeholder="e.g. kingjethro"
              hint={usernameStatus || "3–24 letters, numbers, or underscores."}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
        )}
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <div className="auth-form-field">
            <PasswordField
              id="authPassword"
              label={mode === "reset" ? "New password" : "Password"}
              required
              minLength={mode === "login" ? 1 : 12}
              maxLength={200}
              value={password}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "register" && (
              <div style={{ marginTop: "6px" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon="sparkles"
                  onClick={generatePassword}
                >
                  Generate strong password
                </Button>
              </div>
            )}
          </div>
        )}
        {(mode === "register" || mode === "reset") && (
          <div className="auth-form-field">
            <PasswordField
              id="authConfirm"
              label="Confirm password"
              required
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
        )}
        {mode === "login" && (
          <Link className="auth-page-link" href="/auth?mode=forgot">
            Forgot password?
          </Link>
        )}
        <p className="auth-error" role="alert">
          {error}
        </p>
        <p className="auth-success" role="status">
          {notice}
        </p>
        {awaitingVerification && email.trim() && (
          <div className="auth-resend">
            <Button
              variant="secondary"
              size="sm"
              disabled={resend.sending || resend.wait > 0}
              onClick={() => resend.resend({ email: email.trim() })}
            >
              {resend.label}
            </Button>
            {resend.message && (
              <p
                className={resend.failed ? "auth-error" : "auth-success"}
                role="status"
              >
                {resend.message}
              </p>
            )}
          </div>
        )}
        <div className="auth-page-actions">
          <LinkButton
            variant="secondary"
            href={mode === "login" ? registerHref : loginHref}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </LinkButton>
          <Button
            variant="primary"
            type="submit"
            disabled={busy}
            loading={busy}
            loadingText="Working…"
          >
            {mode === "register"
              ? "Create account"
              : mode === "login"
                ? "Sign in"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Reset password"}
          </Button>
        </div>
        {mode === "register" && (
          <p className="auth-legal">
            By creating an account, you agree to the{" "}
            <Link href="/terms">Terms of Use</Link> and acknowledge the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        )}
      </form>
    </AuthShell>
  );
}
