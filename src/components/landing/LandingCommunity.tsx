"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { RevealHeading } from "@/components/motion/RevealHeading";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import type { CommunityPromptCard as CardType } from "@/lib/community/types";
import CommunityPromptCard from "@/components/community/CommunityPromptCard";

export default function LandingCommunity() {
  const [prompts, setPrompts] = useState<CardType[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/community/prompts?limit=3")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items && Array.isArray(data.items)) {
          setPrompts(data.items);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <section
      className="landing-how"
      id="community"
      style={{ borderTop: "1px solid var(--border, #dbe2dc)" }}
    >
      <div className="landing-section-intro">
        <span className="landing-kicker">COMMUNITY DISCOVERY</span>
        <RevealHeading as="h2">
          Discover what others are creating.
        </RevealHeading>
        <Reveal kind="rise" delay={0.1}>
          <p>
            Explore prompts shared by the PromptDock community. Find ideas worth
            building on, save what works for you, remix prompts into something
            new, and follow the people behind them.
          </p>
        </Reveal>
      </div>

      {loaded && prompts.length > 0 ? (
        <div style={{ marginBottom: 32 }}>
          <Stagger as="div" className="community-grid">
            {prompts.map((card) => (
              <StaggerItem key={card.publicId} as="div" kind="rise">
                <CommunityPromptCard card={card} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      ) : (
        <Reveal kind="fade">
          <div
            className="community-empty-state"
            style={{ margin: "24px 0 32px" }}
          >
            <div className="empty-state-icon" aria-hidden="true">
              ✳
            </div>
            <h4 className="community-empty-title">
              Be the first to share your craft
            </h4>
            <p className="community-empty-desc">
              Prompts shared with Community discovery enabled will appear here
              for everyone to learn from and remix.
            </p>
          </div>
        </Reveal>
      )}

      <Reveal kind="settle" delay={0.15}>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link
            href="/community"
            className="landing-primary-cta"
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            Explore Community <span>↗</span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
