"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";

type RevealVariant = "fade-up" | "fade-in" | "scale-in" | "slide-right";

type Props = {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  threshold?: number;
  className?: string;
  as?: React.ElementType;
};

export default function MotionReveal({
  children,
  variant = "fade-up",
  delay = 0,
  duration = 540,
  threshold = 0.12,
  className = "",
  as: Component = "div",
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "240px 0px 50px 0px" },
    );

    const currentEl = ref.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  const style: React.CSSProperties = {
    transitionDelay: `${delay}ms`,
    transitionDuration: `${duration}ms`,
  };

  return (
    <Component
      ref={ref}
      style={style}
      data-reveal={variant}
      className={`motion-reveal motion-reveal--${variant} ${
        isVisible ? "is-visible" : ""
      } ${className}`.trim()}
    >
      {children}
    </Component>
  );
}
