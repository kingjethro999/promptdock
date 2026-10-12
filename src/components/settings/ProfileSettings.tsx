"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, json } from "@/lib/client/api";
import { describeDevice } from "@/lib/client/device";
import Button from "@/components/ui/Button";
import ConnectedAccounts from "@/components/settings/ConnectedAccounts";

type User = { email: string; username: string | null };
type Session = {
  sessionId: string;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
};

export default function ProfileSettings({
  user,
  admin,
}: {
  user: User;
  admin: boolean;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeArea, setNoticeArea] = useState<
    "password" | "sessions" | "delete"
  >("sessions");
  const [deletePassword, setDeletePassword] = useState("");

  function showNotice(
    area: "password" | "sessions" | "delete",
    message: string,
  ) {
    setNoticeArea(area);
    setNotice(message);
  }

  useEffect(() => {
    api<{ sessions: Session[] }>("/api/auth/sessions")
      .then((result) => setSessions(result.sessions))
      .catch(() => showNotice("sessions", "Could not load active sessions."))
      .finally(() => setSessionsLoading(false));
  }, []);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await json("/api/auth/change-password", "POST", {
        currentPassword,
        newPassword,
      });
      showNotice("password", "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      showNotice(
        "password",
        error instanceof Error ? error.message : "Could not change password.",
      );
    }
  }

  async function revoke(id: string) {
    try {
      const result = await api<{ current: boolean }>(
        `/api/auth/sessions/${id}`,
        { method: "DELETE" },
      );
      if (result.current) {
        router.replace("/auth?mode=login");
        router.refresh();
      } else
        setSessions((current) =>
          current.filter((item) => item.sessionId !== id),
        );
      showNotice("sessions", "Session ended.");
    } catch (error) {
      showNotice(
        "sessions",
        error instanceof Error ? error.message : "Could not end session.",
      );
    }
  }

  async function revokeAll() {
    try {
      await api("/api/auth/logout-all", { method: "POST" });
      router.replace("/auth?mode=login");
      router.refresh();
    } catch (error) {
      showNotice(
        "sessions",
        error instanceof Error ? error.message : "Could not end sessions.",
      );
    }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await json("/api/auth/delete-account", "POST", {
        password: deletePassword,
      });
      router.replace("/");
      router.refresh();
    } catch (error) {
      showNotice(
        "delete",
        error instanceof Error ? error.message : "Could not delete account.",
      );
    }
  }

  return (
    <section className="settings-card react-settings-card">
      <span className="section-kicker">ACCOUNT</span>
      <h2>Sign-in &amp; security</h2>
      <p>
        Signed in as <strong>{user.email}</strong>
      </p>
      {admin && (
        <Link className="settings-admin-link" href="/admin">
          Open admin console ↗
        </Link>
      )}
      <div className="account-username-preview">
        <span>Username: </span>
        <strong>@{user.username || "unset"}</strong>.{" "}
        <a href="#profile" className="account-username-link">
          Edit it in your public profile
        </a>
      </div>
      <form onSubmit={changePassword}>
        <label className="react-field">
          <span>Current password</span>
          <span className="react-password-field">
            <input
              required
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <label className="react-field">
          <span>New password</span>
          <span className="react-password-field">
            <input
              required
              minLength={12}
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <Button type="submit">Change password</Button>
      </form>
      <p className="settings-feedback" role="status">
        {noticeArea === "password" ? notice : ""}
      </p>
      <ConnectedAccounts />
      <div className="settings-session">
        <strong>Active sessions</strong>
        <p>
          Sign out on this device, or end a session you do not recognize. Sign
          out on all devices ends every session at once.
        </p>
        <div className="sessions-list" aria-live="polite">
          {sessionsLoading && (
            <p className="sessions-empty">Loading sessions…</p>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <p className="sessions-empty">No active sessions.</p>
          )}
          {sessions.map((session) => (
            <div className="session-row" key={session.sessionId}>
              <div className="session-info">
                <strong>{describeDevice(session.userAgent)}</strong>
                <small>
                  Signed in {new Date(session.createdAt).toLocaleString()}
                </small>
                {session.current && (
                  <span className="session-badge">This device</span>
                )}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => revoke(session.sessionId)}
              >
                Sign out
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="text-button" onClick={revokeAll}>
          Sign out on all devices ↗
        </button>
        {noticeArea === "sessions" && notice && (
          <p role="status" className="settings-feedback">
            {notice}
          </p>
        )}
      </div>
      <div className="settings-danger">
        <strong>Delete account</strong>
        <p>
          Permanently removes your prompts, revisions, saved provider keys, and
          every session. This cannot be undone.
        </p>
        <form onSubmit={deleteAccount}>
          <label className="react-field">
            <span>Confirm your password</span>
            <span className="react-password-field">
              <input
                required
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
              >
                {showPasswords ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          <Button className="settings-submit" type="submit">
            Delete my account
          </Button>
        </form>
        <p className="settings-feedback" role="status">
          {noticeArea === "delete" ? notice : ""}
        </p>
      </div>
    </section>
  );
}
