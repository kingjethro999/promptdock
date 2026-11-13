"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { readFlag, SUPPORT_LINKS, writeFlag } from "@/lib/client/support";
import { detachBuilderAccount } from "@/stores/prompt-builder-account";
import BrandMark from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/Icon";
import FeedbackDialog from "@/components/landing/FeedbackDialog";
import InviteFriends from "./InviteFriends";

import { RESERVED } from "@/lib/community/username";

type Props = {
  open: boolean;
  close(): void;
  admin: boolean;
  username: string | null;
  onNotice(message: string): void;
  onHelp(): void;
  profileSetupPending?: boolean;
};

const MORE_KEY = "promptdock.sidebar.more";

const isProfilePath = (p: string) =>
  /^\/[^/]+\/?$/.test(p) &&
  !RESERVED.has((p.split("/")[1] || "").toLowerCase());

/**
 * Workspace navigation. Only the three everyday destinations are always
 * visible; account items sit under "More" and support links under "Help".
 * Both groups stay mounted while closed because they own dialogs.
 */
export default function WorkspaceSidebar({
  open,
  close,
  admin,
  username,
  onNotice,
  onHelp,
  profileSetupPending = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const onSettings = pathname.startsWith("/settings");
  const [more, setMore] = useState(false);
  const [help, setHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ total: number }>("/api/prompts?limit=1")
      .then((result) => setLibraryCount(result.total))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (readFlag(MORE_KEY)) setMore(true);
  }, []);
  const moreOpen = more || onSettings;

  useEffect(() => {
    if (!help) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHelp(false);
      helpRef.current?.querySelector<HTMLElement>("button")?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      // Dialogs opened from the menu render outside it; leave them alone.
      if (
        !helpRef.current?.contains(target) &&
        !target.closest?.(".react-modal-backdrop, dialog")
      )
        setHelp(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [help]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      detachBuilderAccount();
      router.replace("/");
      router.refresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <aside className={`sidebar sidebar-refresh${open ? " open" : ""}`}>
      <BrandMark compact />
      <nav className="main-nav" aria-label="Main navigation">
        <Link
          href="/workspace"
          onClick={close}
          data-tour="nav-new-prompt"
          aria-current={pathname === "/workspace" ? "page" : undefined}
          className={`nav-item${pathname === "/workspace" ? " active" : ""}`}
        >
          <Icon name="sparkles" size={17} className="nav-icon" />
          <span>New Prompt</span>
        </Link>

        <Link
          href="/library"
          onClick={close}
          data-tour="nav-library"
          aria-current={pathname.startsWith("/library") ? "page" : undefined}
          className={`nav-item${pathname.startsWith("/library") ? " active" : ""}`}
        >
          <Icon name="library" size={17} className="nav-icon" />
          <span>Library</span>
          {libraryCount !== null && (
            <span className="nav-count">{libraryCount}</span>
          )}
        </Link>

        <Link
          href="/community"
          onClick={close}
          data-tour="nav-community"
          className={`nav-item${
            pathname.startsWith("/community") || isProfilePath(pathname)
              ? " active"
              : ""
          }`}
        >
          <Icon name="users" size={17} className="nav-icon" />
          <span>Community</span>
        </Link>

        {profileSetupPending && (
          <Link
            href="/welcome?next=/workspace"
            onClick={close}
            className="nav-item sidebar-setup-link"
          >
            <Icon name="user" size={17} className="nav-icon" />
            <span>Finish your profile</span>
          </Link>
        )}

        {/* The onboarding tour points at this group for Settings, so the
            target exists whether or not the group is expanded. */}
        <div className="sidebar-more-group" data-tour="nav-settings">
          <button
            type="button"
            className="nav-item sidebar-more-toggle"
            aria-expanded={moreOpen}
            aria-controls="sidebarMore"
            onClick={() => {
              setMore(!moreOpen);
              writeFlag(MORE_KEY, !moreOpen);
            }}
          >
            <Icon
              name={moreOpen ? "chevron-up" : "chevron-down"}
              size={17}
              className="nav-icon"
            />
            <span>More</span>
          </button>
          <div id="sidebarMore" className="sidebar-more" hidden={!moreOpen}>
            <Link
              href="/settings"
              onClick={close}
              aria-current={onSettings ? "page" : undefined}
              className={`nav-item${onSettings ? " active" : ""}`}
            >
              <Icon name="settings" size={17} className="nav-icon" />
              <span>Settings</span>
            </Link>
            <InviteFriends
              username={username}
              closeSidebar={close}
              triggerClassName="nav-item"
            >
              <Icon name="send" size={17} className="nav-icon" />
              <span>Invite friends</span>
            </InviteFriends>
            {admin && (
              <Link href="/admin" onClick={close} className="nav-item">
                <Icon name="shield" size={17} className="nav-icon" />
                <span>Admin console</span>
              </Link>
            )}
            <button type="button" className="nav-item" onClick={logout}>
              <Icon name="logout" size={17} className="nav-icon" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="sidebar-bottom sidebar-help" ref={helpRef}>
        <div
          id="sidebarHelp"
          className="sidebar-help-panel"
          role="group"
          aria-label="Help and support"
          hidden={!help}
        >
          <button
            type="button"
            className="sidebar-help-item"
            onClick={() => {
              setHelp(false);
              close();
              onHelp();
            }}
          >
            <Icon name="info" size={15} />
            <span>How PromptDock works</span>
          </button>
          <FeedbackDialog
            className="sidebar-help-item"
            label={
              <>
                <Icon name="message" size={15} />
                <span>Report an issue or idea</span>
              </>
            }
          />
          {SUPPORT_LINKS.map((link) => (
            <a
              key={link.id}
              className="sidebar-help-item"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="heart" size={15} />
              <span>Support on {link.label}</span>
              <Icon name="external-link" size={12} />
            </a>
          ))}
          <p className="sidebar-help-tip">
            <strong>Better input, better output.</strong> Give your AI a clear
            job, context, and a format to follow.
          </p>
          <nav className="sidebar-legal" aria-label="Legal information">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/copyright">Copyright</Link>
          </nav>
          <div className="sidebar-version">
            PromptDock{" "}
            <span>v{process.env.NEXT_PUBLIC_APP_VERSION || "0.7.4"}</span>
          </div>
        </div>
        <button
          type="button"
          className="nav-item sidebar-help-toggle"
          aria-expanded={help}
          aria-controls="sidebarHelp"
          onClick={() => setHelp(!help)}
        >
          <Icon name="help" size={17} className="nav-icon" />
          <span>Help</span>
        </button>
        <div className="privacy-note">
          <span className="status-dot" />
          <span>Library syncs with your account</span>
        </div>
      </div>
    </aside>
  );
}
