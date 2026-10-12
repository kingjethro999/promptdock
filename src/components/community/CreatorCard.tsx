"use client";

import Link from "next/link";
import type { CommunityCreatorCard } from "@/lib/community/types";
import { avatarFallback, getGravatarUrl } from "@/lib/community/username";
import FollowButton from "./FollowButton";

export default function CreatorCard({
  creator,
}: {
  creator: CommunityCreatorCard;
}) {
  const fallback = avatarFallback(creator.username);
  const gravatar = getGravatarUrl(creator.username, 96);

  return (
    <article className="creator-card">
      <div className="creator-card-top">
        <Link
          href={`/${creator.username}`}
          className="creator-card-profile-link"
        >
          <img
            src={creator.avatarUrl || gravatar}
            alt={creator.displayName}
            className="creator-card-avatar"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fb =
                e.currentTarget.parentElement?.querySelector<HTMLElement>(
                  ".creator-avatar-fallback",
                );
              if (fb) fb.style.display = "inline-flex";
            }}
          />
          <span
            className="creator-card-avatar creator-avatar-fallback"
            data-tone={fallback.tone}
            style={{ display: "none" }}
            aria-hidden="true"
          >
            {fallback.letter}
          </span>
          <div className="creator-card-identity">
            <span className="creator-card-name">{creator.displayName}</span>
            <span className="creator-card-username">@{creator.username}</span>
          </div>
        </Link>

        {!creator.isOwner && (
          <FollowButton
            username={creator.username}
            initialFollowing={Boolean(creator.following)}
            initialCount={creator.followerCount}
          />
        )}
      </div>

      {creator.bio && <p className="creator-card-bio">{creator.bio}</p>}

      <div className="creator-card-footer">
        <span className="creator-card-stat">
          <strong>{creator.promptCount}</strong>{" "}
          {creator.promptCount === 1 ? "prompt" : "prompts"}
        </span>
        <span className="creator-card-stat">
          <strong>{creator.followerCount}</strong>{" "}
          {creator.followerCount === 1 ? "follower" : "followers"}
        </span>
        <Link href={`/${creator.username}`} className="creator-card-view-btn">
          View profile →
        </Link>
      </div>
    </article>
  );
}
