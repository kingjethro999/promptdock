"use client";

import { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/components/motion/env";
import { promptTemplates, type PromptTemplate } from "@/lib/prompt/templates";

/** Something the idea box can suggest: a template, or a plain example idea. */
export type IdeaSuggestion = {
  id: string;
  name: string;
  idea: string;
  template?: PromptTemplate;
};

const EXAMPLES: IdeaSuggestion[] = [
  {
    id: "example-business",
    name: "Start a business",
    idea: "I want to start a small online business selling handmade skincare, but I do not know where to begin.",
  },
  {
    id: "example-app",
    name: "Plan an app",
    idea: "I have an idea for an app that helps people plan meals from ingredients they already have. Help me think it through.",
  },
];

const ALL: IdeaSuggestion[] = [
  ...promptTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    idea: template.idea,
    template,
  })),
  ...EXAMPLES,
];

const TYPE_MS = 40;
const HOLD_MS = 2000;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Cycles through example ideas for the empty idea box, typing each one out.
 * `current` is always the whole idea being shown, so accepting a suggestion
 * never inserts a half-typed fragment. With `active` false, or when the
 * visitor prefers reduced motion, the text stays still.
 */
export function useIdeaSuggestions(active: boolean) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Shuffled after mount: a random order during render would not match the
  // server's HTML.
  const [order, setOrder] = useState<IdeaSuggestion[]>(ALL);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  useEffect(() => setOrder(shuffled(ALL)), []);

  const current = order[index % order.length];
  const animate = active && !reduced;

  useEffect(() => {
    if (!animate) return;
    const done = typed >= current.idea.length;
    const timer = setTimeout(
      () => {
        if (done) {
          setIndex((value) => (value + 1) % order.length);
          setTyped(0);
        } else setTyped(typed + 1);
      },
      done ? HOLD_MS : TYPE_MS,
    );
    return () => clearTimeout(timer);
  }, [animate, typed, current, order.length]);

  const placeholder = useMemo(
    () => (animate ? current.idea.slice(0, typed) : current.idea),
    [animate, current, typed],
  );

  return { current, placeholder, all: ALL };
}
