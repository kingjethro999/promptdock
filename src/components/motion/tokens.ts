export type Bezier = [number, number, number, number];

export const ease: Record<"out" | "inOut" | "in", Bezier> = {
  out: [0.22, 1, 0.36, 1], // arrivals: fast start, long soft landing
  inOut: [0.65, 0, 0.35, 1], // section-to-section moves
  in: [0.5, 0, 0.75, 0], // exits only
};

export const dur = { fast: 0.18, base: 0.4, slow: 0.7, exit: 0.24 } as const;
export const dist = { sm: 16, md: 24, lg: 40 } as const;

// No `type` key, so these work for both useSpring() and transitions.
// In a transition: { type: "spring", ...spring.press }
export const spring = {
  settle: { stiffness: 260, damping: 30, mass: 0.9 },
  press: { stiffness: 520, damping: 34, mass: 0.6 },
  depth: { stiffness: 140, damping: 20, mass: 0.6 },
} as const;

const STEP = 0.06;
const BUDGET = 0.5; // max total seconds a group may spend staggering
export const staggerStep = (n: number) =>
  Math.min(STEP, BUDGET / Math.max(n - 1, 1));

export const REVEAL_MARGIN = "0px 0px -12% 0px"; // trigger slightly after entering the viewport
