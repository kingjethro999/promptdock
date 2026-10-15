"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui";
import type { CommunityCreatorCard } from "@/lib/community/types";
import { avatarFallback } from "@/lib/community/username";
import FollowButton from "./FollowButton";

export default function CreatorCard({
  creator,
}: {
  creator: CommunityCreatorCard;
}) {
  const fallback = avatarFallback(creator.username);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(creator.avatarUrl && failedUrl !== creator.avatarUrl);

  return (
    <article className="creator-card">
      <div className="creator-card-top">
        <Link
          href={`/${creator.username}`}
          className="creator-card-profile-link"
        >
          {showImage ? (
            <img
              src={creator.avatarUrl!}
              alt={creator.displayName}
              className="creator-card-avatar"
              onError={() => setFailedUrl(creator.avatarUrl)}
            />
          ) : (
            <span
              className="creator-card-avatar creator-avatar-fallback"
              data-tone={fallback.tone}
              aria-hidden="true"
            >
              {fallback.letter}
            </span>
          )}
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
          View profile{" "}
          <Icon
            name="arrow-right"
            size={14}
            style={{ display: "inline-block", verticalAlign: "middle" }}
          />
        </Link>
      </div>
    </article>
  );
}
