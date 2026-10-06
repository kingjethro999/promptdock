"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import Button from "@/components/ui/Button";

type Referral = {
  url: string;
  total: number;
  verified: number;
  rewardLevel: number;
  maxRewards: number;
};

export default function InviteFriends({
  username,
  closeSidebar,
}: {
  username: string | null;
  closeSidebar(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const link = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [notice, setNotice] = useState("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [open]);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#invite-friends") void show();
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  async function show() {
    closeSidebar();
    setOpen(true);
    setReferral(null);
    setNotice("");
    setCanShare(typeof navigator.share === "function");
    try {
      setReferral(await api<Referral>("/api/referrals"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Invitation unavailable.",
      );
    }
  }

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  async function copy() {
    if (!referral) return;
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(referral.url);
      else {
        link.current?.select();
        if (!document.execCommand("copy")) throw new Error("Copy failed");
      }
      setNotice("Invitation link copied.");
    } catch {
      link.current?.select();
      setNotice("Select the link above to copy it.");
    }
  }

  async function share() {
    if (!referral || !navigator.share) return;
    try {
      await navigator.share({
        title: `${username || "I"} invited you to PromptDock`,
        text: "Bring your rough ideas. PromptDock helps turn them into useful prompts.",
        url: referral.url,
      });
    } catch {
      // Closing the native share sheet is expected.
    }
  }

  const pending = referral
    ? Math.max(0, referral.total - referral.verified)
    : 0;

  return (
    <>
      <button className="sidebar-feedback" type="button" onClick={show}>
        <span aria-hidden="true">↗</span> Invite friends
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="app-dialog invite-dialog"
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialog.current) close();
          }}
        >
          <button
            className="dialog-close"
            type="button"
            aria-label="Close invitation"
            onClick={close}
          >
            ×
          </button>
          <span className="dialog-icon" aria-hidden="true">
            ↗
          </span>
          <h2>Bring a friend along</h2>
          <p>
            Share PromptDock with someone who has ideas worth building. Each
            friend who verifies an account adds to your hourly AI and voice
            allowance, up to five friends.
          </p>
          <div className="invite-stats" aria-live="polite">
            <div>
              <strong>
                {referral
                  ? `${referral.verified} / ${referral.maxRewards}`
                  : "—"}
              </strong>
              <span>Verified friends</span>
            </div>
            <div>
              <strong>{referral ? `+${referral.rewardLevel * 2}` : "—"}</strong>
              <span>Extra uses per AI action / hour</span>
            </div>
            <div>
              <strong>{referral ? `+${referral.rewardLevel}` : "—"}</strong>
              <span>Extra voice recordings / hour</span>
            </div>
          </div>
          <p className="invite-pending">
            {referral
              ? pending
                ? `${pending} friend${pending === 1 ? "" : "s"} signed up and ${pending === 1 ? "is" : "are"} waiting to verify email.`
                : referral.rewardLevel >= referral.maxRewards
                  ? "You reached the maximum referral bonus. Your link still welcomes new people."
                  : "Your bonus grows when a friend verifies their email."
              : ""}
          </p>
          <label htmlFor="reactInviteLink">Your invitation link</label>
          <input
            id="reactInviteLink"
            ref={link}
            readOnly
            value={referral?.url || ""}
            aria-label="Your invitation link"
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="dialog-actions">
            {canShare && (
              <Button disabled={!referral} onClick={share}>
                Share…
              </Button>
            )}
            <Button variant="primary" disabled={!referral} onClick={copy}>
              Copy link
            </Button>
          </div>
          <p className="settings-feedback" role="status">
            {notice}
          </p>
        </dialog>
      )}
    </>
  );
}
