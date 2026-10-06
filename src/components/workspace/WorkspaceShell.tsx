"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { bindBuilderAccount } from "@/stores/prompt-builder-account";
import { useLegacyLibraryImport } from "@/hooks/useLegacyLibraryImport";
import UpdatesBell from "./UpdatesBell";
import WorkspaceSidebar from "./WorkspaceSidebar";
import HelpDialog from "./HelpDialog";

type Props = {
  user: { id: string; email: string; username: string | null };
  admin: boolean;
  children: React.ReactNode;
};

export default function WorkspaceShell({ user, admin, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  const importNotice = useLegacyLibraryImport(user.id);
  useEffect(() => {
    void bindBuilderAccount(user.id);
  }, [user.id]);
  const label =
    {
      "/workspace": "Idea to prompt",
      "/library": "My library",
      "/settings": "Settings",
    }[pathname] || "PromptDock";

  return (
    <div className="app-shell react-app-shell">
      <button
        className={`sidebar-overlay${open ? " visible" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
      />
      <WorkspaceSidebar
        open={open}
        close={() => setOpen(false)}
        admin={admin}
        username={user.username}
        onNotice={setNotice}
      />
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-chevron">›</span>
            <strong>{label}</strong>
          </div>
          <div className="top-actions">
            <Link className="account-trigger" href="/settings">
              {user.username || user.email}
            </Link>
            <UpdatesBell />
            <button
              className="help-button"
              type="button"
              aria-label="How PromptDock works"
              onClick={() => setHelp(true)}
            >
              ?
            </button>
          </div>
        </header>
        {notice && (
          <p className="settings-feedback" role="alert">
            {notice}
          </p>
        )}
        {importNotice && (
          <p className="settings-feedback" role="status">
            {importNotice}
          </p>
        )}
        {children}
      </main>
      {help && (
        <HelpDialog
          initialTopic={
            pathname === "/library"
              ? "library"
              : pathname === "/settings"
                ? "settings"
                : "create"
          }
          close={() => setHelp(false)}
        />
      )}
    </div>
  );
}
