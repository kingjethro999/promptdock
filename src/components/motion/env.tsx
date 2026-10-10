"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false, // server + hydration: conservative default, avoids hydration mismatch
  );
}

type Env = { reduced: boolean; compact: boolean; fine: boolean };
const EnvCtx = createContext<Env>({
  reduced: false,
  compact: false,
  fine: false,
});
export const useMotionEnv = () => useContext(EnvCtx);

export function MotionProvider({ children }: { children: ReactNode }) {
  // One subscription for the whole app, not one per component.
  // Deliberately NOT Motion's useReducedMotion(): it can differ between server and
  // client on first render and cause a hydration style mismatch.
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compact = useMediaQuery("(max-width: 767px), (max-height: 500px)"); // phones + landscape phones
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");
  const env = useMemo(
    () => ({ reduced, compact, fine }),
    [reduced, compact, fine],
  );

  useEffect(() => {
    document.documentElement.dataset.motion = "ready";
  }, []); // cancels the failsafe

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <EnvCtx.Provider value={env}>{children}</EnvCtx.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}
