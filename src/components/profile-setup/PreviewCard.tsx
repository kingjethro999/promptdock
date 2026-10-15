"use client";

import { BannerPreset } from "@/components/profile/BannerPreset";
import { avatarFallback } from "@/lib/community/username";
import type { Draft, Region } from "./types";

type Props = {
  draft: Draft;
  username: string;
  region: Region | null;
  done?: boolean;
  mini?: boolean;
};

export function PreviewCard({ draft, username, region, done, mini }: Props) {
  const name = draft.displayName.trim() || username;
  const fallback = avatarFallback(username);

  return (
    <div
      className={`pv ${done ? "pv--done" : ""} ${mini ? "pv--mini" : ""}`}
      aria-hidden="true"
      data-mini={mini || undefined}
    >
      {/* Banner Area */}
      <div
        className="pv__banner"
        data-region="banner"
        data-on={region === "banner" || undefined}
      >
        {draft.banner.kind === "preset" ? (
          <BannerPreset id={draft.banner.id} />
        ) : draft.banner.kind === "image" ? (
          <img
            src={draft.banner.previewUrl}
            alt=""
            className="pv__banner-img"
          />
        ) : (
          <div className="pv__empty-cover" />
        )}
      </div>

      {/* Profile Header Content (Avatar + Identity + Bio) */}
      <div className="pv__content">
        <div
          className="pv__avatar"
          data-region="avatar"
          data-on={region === "avatar" || undefined}
        >
          {draft.avatar.kind === "image" ? (
            <img
              src={draft.avatar.previewUrl}
              alt=""
              className="pv__avatar-img"
            />
          ) : draft.avatar.kind === "generated" ? (
            <img src={draft.avatar.uri} alt="" className="pv__avatar-img" />
          ) : (
            <div className="pv__avatar-fallback" data-tone={fallback.tone}>
              {fallback.letter}
            </div>
          )}
        </div>

        <div className="pv__identity">
          <p
            className="pv__name"
            data-region="name"
            data-on={region === "name" || undefined}
          >
            {name}
          </p>
          <p className="pv__handle">@{username}</p>
        </div>

        {!mini && (
          <p
            className="pv__bio"
            data-region="bio"
            data-on={region === "bio" || undefined}
          >
            {draft.bio.trim() || (
              <span className="pv__bio-empty">Your bio will appear here</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default PreviewCard;
