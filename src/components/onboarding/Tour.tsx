"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMotionEnv } from "@/components/motion/env";
import { useScrollLock } from "@/components/scroll/useScrollLock";
import { record } from "@/lib/onboarding/persist";
import { waitForTarget, useTargetRect } from "@/lib/onboarding/target";
import type { ClientExperience, Step } from "@/lib/onboarding/types";
import { Spotlight } from "./Spotlight";
import { TourCard } from "./TourCard";

function trapFocus(e: React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== "Tab" || !container) return;
  const focusables = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

type Props = {
  exp: ClientExperience;
  onClose(): void;
};

export function Tour({ exp, onClose }: Props) {
  const router = useRouter();
  const { reduced, compact } = useMotionEnv();
  const steps = useMemo(
    () =>
      exp.steps.map((s) => (compact && s.compact ? { ...s, ...s.compact } : s)),
    [exp, compact],
  );

  const [i, setI] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const reached = useRef(1);
  const ended = useRef(false);

  const step = steps[i];
  const rect = useTargetRect(target);
  useScrollLock(true);

  useEffect(() => {
    setMounted(true);
    opener.current = document.activeElement;
  }, []);

  // Inert background while tour is active
  useEffect(() => {
    const roots = [...document.body.children].filter(
      (n) => !(n as HTMLElement).dataset.tourRoot,
    ) as HTMLElement[];
    roots.forEach((n) => n.setAttribute("inert", ""));
    return () => {
      roots.forEach((n) => n.removeAttribute("inert"));
    };
  }, []);

  // Handle step setup: resolve target and focus card heading
  useEffect(() => {
    let live = true;
    (async () => {
      if (step.kind === "spotlight" && step.target) {
        const el = await waitForTarget(step.target);
        if (!live) return;
        if (!el) {
          // If target not found, advance in direction of travel
          return void go(dir);
        }
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
        setTarget(el);
      } else {
        setTarget(null);
      }

      reached.current = Math.max(reached.current, i + 1);
      if (i === 0) {
        record(exp.id, "shown", 1);
      }

      requestAnimationFrame(() => {
        cardRef.current
          ?.querySelector<HTMLElement>("[data-tour-title]")
          ?.focus();
      });
    })();

    return () => {
      live = false;
    };
  }, [i]);

  function go(d: 1 | -1) {
    setDir(d);
    const n = i + d;
    if (n >= steps.length) {
      return finish("completed", step.cta);
    }
    if (n < 0) return;
    setI(n);
  }

  function finish(
    status: "completed" | "skipped" | "dismissed",
    cta?: Step["cta"],
  ) {
    if (ended.current) return;
    ended.current = true;
    record(
      exp.id,
      status,
      status === "completed" ? steps.length : reached.current,
    );
    onClose();

    queueMicrotask(() => {
      if (cta?.href) {
        router.push(cta.href);
      } else if (cta?.focus) {
        const el = document.querySelector<HTMLElement>(
          `[data-tour="${CSS.escape(cta.focus)}"]`,
        );
        el?.focus();
      } else {
        (opener.current as HTMLElement | null)?.focus?.();
      }
    });
  }

  // Dismiss on pagehide if still open
  useEffect(() => {
    const handlePageHide = () => {
      if (!ended.current) {
        record(exp.id, "dismissed", reached.current);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [exp.id]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      finish("dismissed");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Tab") {
      trapFocus(e, cardRef.current);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  const last = i === steps.length - 1;

  return createPortal(
    <div data-tour-root="true" onKeyDown={onKeyDown}>
      <Spotlight rect={target ? rect : null} />
      <TourCard
        ref={cardRef}
        step={step}
        index={i}
        total={steps.length}
        rect={target ? rect : null}
        compact={compact}
        last={last}
        onNext={() => (last ? finish("completed", step.cta) : go(1))}
        onBack={() => go(-1)}
        onSkip={() => finish(i === 0 ? "skipped" : "dismissed")}
      />
    </div>,
    document.body,
  );
}

export default Tour;
