"use client";

import { useEffect, useRef } from "react";
import { useMotionEnv } from "@/components/motion/env";

type Props = {
  dir: 1 | -1;
  stepKey: string;
  children: React.ReactNode;
};

export function StepFrame({ dir, stepKey, children }: Props) {
  const { reduced } = useMotionEnv();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the h1 in the incoming step so screen readers announce it
    const heading = panelRef.current?.querySelector<HTMLElement>(
      "h1[tabIndex='-1'], h1",
    );
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, [stepKey]);

  return (
    <div className="setup__stack">
      <section
        ref={panelRef}
        key={stepKey}
        data-dir={dir}
        data-reduced={reduced || undefined}
        className="setup__panel"
      >
        {children}
      </section>
    </div>
  );
}

export default StepFrame;
