"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Glyph } from "@/components/ui/Glyph";
import { record } from "@/lib/onboarding/persist";
import { PROFILE_FLOW_ID } from "@/lib/onboarding/registry";
import { rasterize } from "@/lib/profile/avatar-gen";
import { uploadProcessed } from "@/lib/profile/upload-client";
import { cleanDisplayName } from "@/lib/profile/validate";
import { useCommitQueue } from "./useCommitQueue";
import { useViewportHeightVar, useKeyboardOpen } from "./useViewportHeightVar";
import { STEPS, type Draft, type StepId } from "./types";
import { PreviewCard } from "./PreviewCard";
import { StepFrame } from "./StepFrame";
import { NameStep } from "./NameStep";
import { PhotoStep } from "./PhotoStep";
import { BannerStep } from "./BannerStep";
import { BioStep } from "./BioStep";
import { DoneStep } from "./DoneStep";

type Props = {
  mode: "signup" | "edit";
  next: string;
  username: string;
  initial: Draft;
  siteHost: string;
};

export function ProfileSetup({
  mode,
  next,
  username,
  initial,
  siteHost,
}: Props) {
  const router = useRouter();
  const queue = useCommitQueue();
  const [index, setIndex] = useState(0); // 0..3 = steps, 4 = done
  const [dir, setDir] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<Draft>(initial);
  const committed = useRef<{
    displayName?: string | null;
    avatar?: string;
    banner?: string;
    bio?: string | null;
  }>({});
  const reached = useRef(1);
  const ended = useRef(false);
  const signup = mode === "signup";
  const step = STEPS[index];
  const keyboardOpen = useKeyboardOpen();

  useViewportHeightVar();

  // Record impression for new users
  useEffect(() => {
    if (signup) {
      record(PROFILE_FLOW_ID, "shown", 1);
    }
  }, [signup]);

  // Pagehide fallback dismissal
  useEffect(() => {
    const handlePageHide = () => {
      if (signup && !ended.current) {
        record(PROFILE_FLOW_ID, "dismissed", reached.current);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [signup]);

  // Prefetch next route when reaching done screen
  useEffect(() => {
    if (index === 4) {
      router.prefetch(next);
    }
  }, [index, next, router]);

  async function patchProfile(data: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error("Failed to update profile");
    }
  }

  function save(id: StepId) {
    if (id === "name") {
      const r = cleanDisplayName(draft.displayName);
      const val = r.ok ? r.value : null;
      if (val !== committed.current.displayName) {
        committed.current.displayName = val;
        queue.run("name", () => patchProfile({ displayName: val }));
      }
    } else if (id === "photo") {
      if (draft.avatar.kind === "generated") {
        const a = draft.avatar;
        if (committed.current.avatar !== a.id) {
          committed.current.avatar = a.id;
          queue.run("avatar", async () => {
            const blob = await rasterize(a.svg, 512);
            const avatarUrl = await uploadProcessed("avatar", blob);
            await patchProfile({ avatarUrl });
          });
        }
      } else if (draft.avatar.kind === "image") {
        const a = draft.avatar;
        if (committed.current.avatar !== a.id) {
          committed.current.avatar = a.id;
          queue.run("avatar", async () => {
            const avatarUrl = await uploadProcessed("avatar", a.blob);
            await patchProfile({ avatarUrl });
          });
        }
      } else if (draft.avatar.kind === "none") {
        if (committed.current.avatar !== "none") {
          committed.current.avatar = "none";
          queue.run("avatar", () => patchProfile({ avatarUrl: null }));
        }
      }
    } else if (id === "banner") {
      if (draft.banner.kind === "preset") {
        const b = draft.banner;
        if (committed.current.banner !== `preset:${b.id}`) {
          committed.current.banner = `preset:${b.id}`;
          queue.run("banner", () => patchProfile({ bannerPreset: b.id }));
        }
      } else if (draft.banner.kind === "image") {
        const b = draft.banner;
        if (committed.current.banner !== b.id) {
          committed.current.banner = b.id;
          queue.run("banner", async () => {
            const bannerUrl = await uploadProcessed("banner", b.blob);
            await patchProfile({ bannerUrl });
          });
        }
      } else if (draft.banner.kind === "none") {
        if (committed.current.banner !== "none") {
          committed.current.banner = "none";
          queue.run("banner", () =>
            patchProfile({ bannerUrl: null, bannerPreset: null }),
          );
        }
      }
    } else if (id === "bio") {
      const bioVal = draft.bio.trim() || null;
      if (bioVal !== committed.current.bio) {
        committed.current.bio = bioVal;
        queue.run("bio", () => patchProfile({ bio: bioVal }));
      }
    }
  }

  const go = (d: 1 | -1) => {
    setDir(d);
    setIndex((i) => {
      const n = Math.min(4, Math.max(0, i + d));
      reached.current = Math.max(reached.current, n + 1);
      return n;
    });
  };

  const onContinue = () => {
    if (step) save(step.id);
    go(1);
  };

  async function leave(status: "completed" | "skipped") {
    if (ended.current) return;
    ended.current = true;
    if (signup) {
      await record(
        PROFILE_FLOW_ID,
        status,
        status === "completed" ? 5 : reached.current,
      );
    }
    router.push(next);
  }

  async function finish() {
    await queue.settled();
    if (Object.keys(queue.failed).length > 0) {
      return false;
    }
    await leave("completed");
    return true;
  }

  return (
    <div className="setup">
      {/* Header with Logo and Skip */}
      <header className="setup__header">
        <div className="setup__header-inner">
          <Link href="/" className="setup__brand" aria-label="PromptDock home">
            <span className="setup__brand-mark">
              <Glyph name="spark" size={14} />
            </span>
            <span className="setup__brand-text">
              prompt<span>dock</span>
            </span>
          </Link>

          <button
            type="button"
            className="setup__skip-link"
            onClick={() => leave("skipped")}
          >
            {signup ? "Skip setup" : "Close"}
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="setup__main">
        <div className="setup__stage">
          {/* Hero Preview Card */}
          <div className="setup__preview-slot">
            <PreviewCard
              draft={draft}
              username={username}
              region={step?.region ?? null}
              done={index === 4}
              mini={keyboardOpen}
            />
          </div>

          {/* Form Step Column */}
          <div className="setup__column">
            {index < 4 && (
              <div className="setup__progress-wrap">
                <span className="setup__progress-label">
                  Step {index + 1} of 4
                </span>
                <ol className="setup__progress" aria-hidden="true">
                  {STEPS.map((s, i) => (
                    <li
                      key={s.id}
                      className={`setup__progress-segment ${
                        i <= index ? "is-filled" : ""
                      }`}
                    />
                  ))}
                </ol>
              </div>
            )}

            <StepFrame dir={dir} stepKey={step?.id ?? "done"}>
              {step?.id === "name" && (
                <NameStep
                  draft={draft}
                  setDraft={setDraft}
                  username={username}
                  siteHost={siteHost}
                  onContinue={onContinue}
                />
              )}
              {step?.id === "photo" && (
                <PhotoStep
                  draft={draft}
                  setDraft={setDraft}
                  initial={initial}
                  username={username}
                  onContinue={onContinue}
                  onBack={() => go(-1)}
                />
              )}
              {step?.id === "banner" && (
                <BannerStep
                  draft={draft}
                  setDraft={setDraft}
                  initial={initial}
                  onContinue={onContinue}
                  onBack={() => go(-1)}
                />
              )}
              {step?.id === "bio" && (
                <BioStep
                  draft={draft}
                  setDraft={setDraft}
                  initial={initial}
                  onContinue={onContinue}
                  onBack={() => go(-1)}
                />
              )}
              {index === 4 && (
                <DoneStep
                  draft={draft}
                  username={username}
                  failed={queue.failed}
                  onRetry={queue.retry}
                  onFinish={finish}
                  onAnyway={() => leave("completed")}
                  onBack={() => go(-1)}
                />
              )}
            </StepFrame>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProfileSetup;
