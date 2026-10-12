"use client";

import Link from "next/link";
import type { PublicProfile } from "@/lib/community/types";
import { avatarFallback, getGravatarUrl } from "@/lib/community/username";
import FollowButton from "./FollowButton";

type ViewProps = {
  mode?: "view";
  profile: PublicProfile;
};

type EditProps = {
  mode: "edit";
  draft: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
  };
  onPickBanner(): void;
  onPickAvatar(): void;
  onRemoveBanner?(): void;
  onRemoveAvatar?(): void;
};

type Props = ViewProps | EditProps;

export default function ProfileHeader(props: Props) {
  const isEdit = props.mode === "edit";
  const username = isEdit ? props.draft.username : props.profile.username;
  const displayName = isEdit
    ? props.draft.displayName || props.draft.username
    : props.profile.displayName;
  const bannerUrl = isEdit ? props.draft.bannerUrl : props.profile.bannerUrl;
  const avatarUrl = isEdit ? props.draft.avatarUrl : props.profile.avatarUrl;
  const bio = isEdit ? props.draft.bio : props.profile.bio;

  const fallback = avatarFallback(username);

  return (
    <div className={`profile-wrapper ${isEdit ? "profile-wrapper--edit" : ""}`}>
      {/* Banner */}
      <div
        className={`profile-banner ${isEdit ? "profile-banner--clickable" : ""}`}
        onClick={isEdit ? props.onPickBanner : undefined}
        role={isEdit ? "button" : undefined}
        tabIndex={isEdit ? 0 : undefined}
        aria-label={isEdit ? "Change cover image" : undefined}
      >
        {bannerUrl ? (
          <img src={bannerUrl} alt="" loading="lazy" />
        ) : isEdit ? (
          <div className="profile-banner-empty">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span>Add a cover image</span>
          </div>
        ) : null}

        {isEdit && bannerUrl && (
          <div className="profile-banner-overlay" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span>Change cover</span>
          </div>
        )}
      </div>

      <div className="profile-header-content">
        <div className="profile-avatar-container">
          <div
            className={`profile-avatar-wrapper ${isEdit ? "profile-avatar-wrapper--clickable" : ""}`}
            onClick={isEdit ? props.onPickAvatar : undefined}
            role={isEdit ? "button" : undefined}
            tabIndex={isEdit ? 0 : undefined}
            aria-label={isEdit ? "Change profile photo" : undefined}
          >
            <img
              src={avatarUrl || getGravatarUrl(username, 256)}
              alt={displayName}
              className="profile-avatar"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallbackEl =
                  e.currentTarget.parentElement?.querySelector<HTMLElement>(
                    ".profile-avatar-fallback",
                  );
                if (fallbackEl) fallbackEl.style.display = "flex";
              }}
            />
            <div
              className="profile-avatar profile-avatar-fallback"
              data-tone={fallback.tone}
              style={{ display: "none" }}
              aria-hidden="true"
            >
              {fallback.letter}
            </div>

            {isEdit && (
              <div className="profile-avatar-edit-badge" aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
            )}
          </div>

          <div className="profile-actions">
            {!isEdit && props.profile.isOwner ? (
              <Link
                href="/settings#profile"
                className="community-btn"
                style={{ minHeight: 44, padding: "8px 18px", fontSize: 14 }}
              >
                Edit Profile
              </Link>
            ) : !isEdit ? (
              <FollowButton
                username={props.profile.username}
                initialFollowing={props.profile.following ?? false}
                initialCount={props.profile.followerCount}
              />
            ) : null}
          </div>
        </div>

        <div className="profile-names">
          <h1 className="profile-display-name">{displayName}</h1>
          <p className="profile-username">@{username}</p>
        </div>

        {bio && <div className="profile-bio">{bio}</div>}

        {!isEdit && (
          <div className="profile-stats">
            <span>
              <strong>{props.profile.followerCount}</strong> followers
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
