"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { promptTemplates } from "@/lib/prompt/templates";
import { usePromptBuilderStore } from "@/stores/prompt-builder";
import { detachBuilderAccount } from "@/stores/prompt-builder-account";
import BrandMark from "@/components/ui/BrandMark";
import FeedbackDialog from "@/components/landing/FeedbackDialog";
import InviteFriends from "./InviteFriends";

import { RESERVED } from "@/lib/community/username";

type Props = {
  open: boolean;
  close(): void;
  admin: boolean;
  username: string | null;
  onNotice(message: string): void;
};

const isProfilePath = (p: string) =>
  /^\/[^/]+\/?$/.test(p) &&
  !RESERVED.has((p.split("/")[1] || "").toLowerCase());

function CommunityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ verticalAlign: "middle" }}
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function WorkspaceSidebar({
  open,
  close,
  admin,
  username,
  onNotice,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const loadTemplate = usePromptBuilderStore((state) => state.loadTemplate);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  useEffect(() => {
    api<{ total: number }>("/api/prompts?limit=1")
      .then((result) => setLibraryCount(result.total))
      .catch(() => {});
  }, [pathname]);

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

  function selectTemplate(id: string) {
    const template = promptTemplates.find((item) => item.id === id);
    if (!template) return;
    loadTemplate(template);
    close();
    router.push("/workspace");
  }

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <BrandMark compact />
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <Link
          href="/workspace"
          onClick={close}
          data-tour="nav-new-prompt"
          className={`nav-item${pathname === "/workspace" ? " active" : ""}`}
        >
          <span className="nav-icon" aria-hidden="true">
            ✦
          </span>
          <span>New Prompt</span>
        </Link>

        <Link
          href="/library"
          onClick={close}
          data-tour="nav-library"
          className={`nav-item${pathname.startsWith("/library") ? " active" : ""}`}
        >
          <span className="nav-icon" aria-hidden="true">
            ▦
          </span>
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
          <span className="nav-icon" aria-hidden="true">
            <CommunityIcon />
          </span>
          <span>Community</span>
        </Link>

        <Link
          href="/settings"
          onClick={close}
          data-tour="nav-settings"
          className={`nav-item${pathname.startsWith("/settings") ? " active" : ""}`}
        >
          <span className="nav-icon" aria-hidden="true">
            ⚙
          </span>
          <span>Settings</span>
        </Link>
      </nav>
      <div className="sidebar-divider" />
      <div className="sidebar-label sidebar-label-row">
        <span>QUICK STARTS</span>
        <span className="tiny-sparkle" aria-hidden="true">
          ✳
        </span>
      </div>
      <nav className="template-nav" aria-label="Quick starts">
        {promptTemplates.map((item) => (
          <button
            type="button"
            className="template-item"
            key={item.id}
            onClick={() => selectTemplate(item.id)}
          >
            <span className="template-glyph" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <InviteFriends username={username} closeSidebar={close} />
        <FeedbackDialog
          className="sidebar-feedback"
          label="✎  Report an issue or idea"
        />
        <div className="sidebar-sponsor">
          <Image
            className="sidebar-sponsor-icon"
            src="/assets/brands/github.png"
            alt="GitHub"
            width={26}
            height={26}
          />
          <strong>Enjoying PromptDock?</strong>
          <p>Help shape what comes next.</p>
          <a
            href="https://github.com/sponsors/kingjethro999"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sponsor on GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
        <button type="button" className="sidebar-signout" onClick={logout}>
          <span aria-hidden="true">↗</span> Sign out
        </button>
        {admin && (
          <Link href="/admin" className="sidebar-feedback">
            ✦ Admin console ↗
          </Link>
        )}
        <div className="tip-card">
          <span className="tip-icon" aria-hidden="true">
            ✦
          </span>
          <strong>Better input. Better output.</strong>
          <p>Give your AI a clear job, context, and a format to follow.</p>
        </div>
        <div className="privacy-note">
          <span className="status-dot" />
          <span>Library syncs with your account</span>
        </div>
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
    </aside>
  );
}
