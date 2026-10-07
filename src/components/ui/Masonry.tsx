"use client";

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  gap?: number;
  rowGap?: number;
  minColumnWidth?: number;
  maxColumns?: number;
  columnWeights?: readonly number[];
};

/** Packs cards into the currently shortest column while retaining DOM order. */
export default function Masonry({
  children,
  className = "",
  gap = 20,
  rowGap,
  minColumnWidth = 420,
  maxColumns = 2,
  columnWeights,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const itemKeys = items
    .map((item, index) => (isValidElement(item) ? item.key : index))
    .join("|");
  const verticalGap = rowGap ?? gap;

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
      const weights = Array.from(
        { length: columns },
        (_, index) => columnWeights?.[index] || 1,
      );
      const usableWidth = width - gap * (columns - 1);
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const cardWidths = weights.map(
        (weight) => (usableWidth * weight) / totalWeight,
      );
      const offsets = cardWidths.map(
        (_, index) =>
          cardWidths.slice(0, index).reduce((sum, value) => sum + value, 0) +
          index * gap,
      );
      const heights = Array(columns).fill(0) as number[];
      element.classList.add("is-measured");
      for (const card of cards) {
        const column = heights.indexOf(Math.min(...heights));
        card.style.width = `${cardWidths[column]}px`;
        card.style.left = `${offsets[column]}px`;
        card.style.top = `${heights[column]}px`;
        heights[column] += card.offsetHeight + verticalGap;
      }
      element.style.height = `${Math.max(...heights) - verticalGap}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(arrange);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    for (const card of element.children) observer.observe(card);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [itemKeys, gap, minColumnWidth, maxColumns, columnWeights, verticalGap]);

  return (
    <div
      className={`react-masonry ${className}`}
      ref={root}
      style={{ columnGap: gap, rowGap: verticalGap }}
    >
      {items.map((child, index) => (
        <div
          className="react-masonry-item"
          key={isValidElement(child) ? child.key : index}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
