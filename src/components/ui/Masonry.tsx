"use client";

import { Children, useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  gap?: number;
  minColumnWidth?: number;
  maxColumns?: number;
};

/** Packs cards into the currently shortest column while retaining DOM order. */
export default function Masonry({
  children,
  className = "",
  gap = 20,
  minColumnWidth = 420,
  maxColumns = 2,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const count = Children.count(children);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const arrange = () => {
      frame = 0;
      const cards = Array.from(element.children) as HTMLElement[];
      const width = element.clientWidth;
      if (!width || !cards.length) return;
      const columns = Math.min(
        maxColumns,
        Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))),
      );
      const cardWidth = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0) as number[];
      element.classList.add("is-measured");
      for (const card of cards) card.style.width = `${cardWidth}px`;
      for (const card of cards) {
        const column = heights.indexOf(Math.min(...heights));
        card.style.left = `${column * (cardWidth + gap)}px`;
        card.style.top = `${heights[column]}px`;
        heights[column] += card.offsetHeight + gap;
      }
      element.style.height = `${Math.max(...heights) - gap}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(arrange);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    for (const card of element.children) observer.observe(card);
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count, gap, minColumnWidth, maxColumns]);

  return (
    <div className={`react-masonry ${className}`} ref={root}>
      {Children.map(children, (child) => (
        <div className="react-masonry-item">{child}</div>
      ))}
    </div>
  );
}
