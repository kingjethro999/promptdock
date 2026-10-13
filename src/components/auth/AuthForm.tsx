"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, json } from "@/lib/client/api";
import {
  firebaseConfigured,
  signInWithProvider,
  type FirebaseProvider,
} from "@/lib/client/firebase";
import {
  Button,
  LinkButton,
  TextField,
  PasswordField,
  Glyph,
} from "@/components/ui";

type Mode = "login" | "register" | "forgot" | "verify" | "reset";
const validModes = new Set<Mode>([
  "login",
  "register",
  "forgot",
  "verify",
  "reset",
]);

export default function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const rawMode = params.get("mode") as Mode;
  const mode = validModes.has(rawMode) ? rawMode : "login";
  const token = params.get("token");
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
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
      const idToken = await signInWithProvider(provider);
      await json("/api/auth/firebase", "POST", { idToken });
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
            res.available
              ? "Available"
              : "That handle is taken or reserved.",
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

  useEffect(() => {
    if (mode !== "verify" || !token) return;
    let cancelled = false;
    json<{ ok?: boolean }>("/api/auth/verify", "POST", { token })
      .then(() => {
        if (!cancelled) setNotice("Email verified. You can sign in now.");
      })
      .catch((issue) => {
        if (!cancelled)
          setError(
            issue instanceof Error
              ? issue.message
              : "This link could not be verified.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [mode, token]);

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
        setNotice("Check your inbox for a verification link, then sign in.");
      } else if (mode === "forgot") {
        await json("/api/auth/forgot", "POST", { email });
        setNotice("If the account exists, a reset link is on its way.");
      } else if (mode === "reset") {
        await json("/api/auth/reset", "POST", { token, password });
        setNotice("Password changed. Sign in with your new password.");
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  const title = {
    login: "Sign in",
    register: "Create account",
    forgot: "Forgot password?",
    verify: "Verify your email",
    reset: "Reset password",
  }[mode];
  const loginHref = `/auth?mode=login&next=${encodeURIComponent(nextPage)}`;
  const registerHref = `/auth?mode=register&next=${encodeURIComponent(nextPage)}`;

  return (
    <div className="auth-page-body">
      <main className="auth-page">
        <section className="auth-story" aria-label="About PromptDock">
          <Link className="auth-brand" href="/" aria-label="PromptDock home">
            <span className="auth-brand-mark">
              <Glyph name="spark" size={16} />
            </span>
            <span>
              prompt<span>dock</span>
              <small>YOUR AI WORKSPACE</small>
            </span>
          </Link>
          <div className="auth-story-copy">
            <span className="landing-kicker">
              YOUR IDEAS, WITH A CLEARER PATH
            </span>
            <h1>Turn a rough thought into a prompt worth keeping.</h1>
            <p>
              Save what works, return from any device, and share your best
              prompts with your people.
            </p>
          </div>
          <div className="auth-story-note">
            <span><Glyph name="star" size={14} /></span> Start free. Bring your own model keys when you are
            ready.
          </div>
        </section>
        <section className="auth-panel" aria-labelledby="authTitle">
          <Link className="auth-back" href="/">
            <Glyph name="arrow-right" size={14} style={{ transform: "rotate(180deg)", display: "inline-block" }} /> Back to PromptDock
          </Link>
          <div className="auth-card">
            <span className="auth-card-mark" aria-hidden="true">
              <Glyph name="spark" size={20} />
            </span>
            <h1 id="authTitle">{title}</h1>
            <p>
              {mode === "register"
                ? "Create your account to save prompts on any device."
                : mode === "login"
                  ? "Sign in to open your saved prompts on any device."
                  : mode === "verify"
                    ? "We’re checking your verification link."
                    : mode === "forgot"
                      ? "We’ll send you a link to reset your password."
                      : "Choose a new password for your account."}
            </p>
            {mode !== "verify" && (
              <form onSubmit={submit} noValidate>
                {firebaseConfigured &&
                  (mode === "login" || mode === "register") && (
                    <>
                      <div className="auth-provider-actions">
                        {(["google", "github"] as FirebaseProvider[]).map(
                          (provider) => (
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
                          ),
                        )}
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
                {(mode === "login" ||
                  mode === "register" ||
                  mode === "reset") && (
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
            )}
            {mode === "verify" && (
              <>
                <p
                  className={error ? "auth-error" : "auth-success"}
                  role="status"
                >
                  {error || notice || "Checking your link…"}
                </p>
                <LinkButton variant="primary" href={loginHref}>
                  Sign in
                </LinkButton>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
