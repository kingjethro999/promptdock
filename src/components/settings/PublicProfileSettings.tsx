"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { validateUsername } from "@/lib/community/username";
import { decode } from "@/lib/community/image";
import ProfileHeader from "@/components/community/ProfileHeader";
import ImageCropDialog from "@/components/community/ImageCropDialog";
import LiquidButton, {
  type LiquidButtonStatus,
} from "@/components/ui/LiquidButton";

type ProfileData = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  communityAudience: "public" | "followers";
  usernameChangedAt: string | null;
};

type CropTarget = {
  bitmap: ImageBitmap;
  kind: "avatar" | "banner";
};

export default function PublicProfileSettings() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<LiquidButtonStatus>("idle");
  const [feedback, setFeedback] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [audience, setAudience] = useState<"public" | "followers">("public");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<string>("");
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileData | null) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.displayName || data.username || "");
          setUsername(data.username || "");
          setBio(data.bio || "");
          setAudience(data.communityAudience || "public");
          setAvatarUrl(data.avatarUrl);
          setBannerUrl(data.bannerUrl);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Username validation & availability debounce
  useEffect(() => {
    if (!profile || username === profile.username) {
      setUsernameStatus("");
      return;
    }
    const val = validateUsername(username);
    if (!val.ok) {
      setUsernameStatus(
        val.reason === "reserved"
          ? "This username is reserved."
          : "3–30 lowercase letters, numbers, hyphens, or underscores.",
      );
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/username-check?username=${encodeURIComponent(username)}`,
        );
        const data = await res.json();
        if (data.available) {
          setUsernameStatus("Username available");
        } else {
          setUsernameStatus("Username is already taken.");
        }
      } catch {
        setUsernameStatus("");
      }
    }, 300);

    return () => clearTimeout(t);
  }, [username, profile]);

  async function handleFilePicked(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "banner",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const bitmap = await decode(file);
      setCropTarget({ bitmap, kind });
    } catch {
      setFeedback("Could not read this image. Please choose another file.");
      setSaveStatus("error");
    }
  }

  async function handleCropApply(blob: Blob, previewUrl: string) {
    if (!cropTarget) return;
    const { kind } = cropTarget;
    setCropTarget(null);

    // Optimistic preview
    if (kind === "avatar") setAvatarUrl(previewUrl);
    else setBannerUrl(previewUrl);

    try {
      const signRes = await fetch("/api/profile/assets/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });

      if (!signRes.ok) throw new Error("Could not prepare upload");
      const { uploadUrl, fields } = await signRes.json();

      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) {
        formData.append(k, String(v));
      }
      formData.append("file", blob);

      const cloudRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!cloudRes.ok) throw new Error("Direct upload failed");
      const cloudData = await cloudRes.json();

      if (kind === "avatar") setAvatarUrl(cloudData.secure_url);
      else setBannerUrl(cloudData.secure_url);

      setFeedback("Image uploaded. Remember to save your profile.");
      setSaveStatus("idle");
    } catch {
      setFeedback(`Failed to upload ${kind}. Please try again.`);
      setSaveStatus("error");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("loading");
    setFeedback("");

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          username: username !== profile?.username ? username : undefined,
          bio: bio || null,
          avatarUrl,
          bannerUrl,
          communityAudience: audience,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "username_cooldown") {
          throw new Error("Usernames can only be changed once every 30 days.");
        }
        if (data.error === "username_taken") {
          throw new Error("This username is already taken.");
        }
        throw new Error(data.error || "Failed to update profile.");
      }

      setProfile(data);
      setSaveStatus("success");
      setFeedback("Public profile saved successfully.");
      setTimeout(() => setSaveStatus("idle"), 3500);
    } catch (err: unknown) {
      setSaveStatus("error");
      setFeedback(err instanceof Error ? err.message : "Error saving profile");
    }
  }

  if (loading) {
    return (
      <section className="settings-card profile-editor-card" id="profile">
        <div className="section-kicker">COMMUNITY</div>
        <h2>Public Profile</h2>
        <p className="profile-editor__loading">Loading profile settings…</p>
      </section>
    );
  }

  return (
    <section className="settings-card profile-editor-card" id="profile">
      <div className="profile-editor__header">
        <div className="section-kicker">COMMUNITY</div>
        <h2>Public Profile</h2>
        <p>This is how prompt engineers see you across PromptDock.</p>
      </div>

      {/* Hidden file pickers */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFilePicked(e, "avatar")}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFilePicked(e, "banner")}
      />

      {cropTarget && (
        <ImageCropDialog
          bitmap={cropTarget.bitmap}
          kind={cropTarget.kind}
          onApply={handleCropApply}
          onCancel={() => {
            cropTarget.bitmap.close?.();
            setCropTarget(null);
          }}
        />
      )}

      <form onSubmit={handleSave} className="profile-editor__form">
        <div className="profile-editor__grid">
          {/* Left Column: Live Preview */}
          <div className="profile-editor__preview-col">
            <span className="profile-editor__column-label">Live Preview</span>
            <div className="profile-editor__preview-shell">
              <ProfileHeader
                mode="edit"
                draft={{
                  username: username || "username",
                  displayName: displayName || username || "Display Name",
                  avatarUrl,
                  bannerUrl,
                  bio,
                }}
                onPickBanner={() => bannerInputRef.current?.click()}
                onPickAvatar={() => avatarInputRef.current?.click()}
              />
            </div>
            <p className="profile-editor__preview-hint">
              Click banner or avatar in the preview to upload a new image.
            </p>
          </div>

          {/* Right Column: Edit Fields */}
          <div className="profile-editor__fields-col">
            <span className="profile-editor__column-label">
              Profile Details
            </span>

            <label className="react-field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or handle"
                maxLength={50}
              />
            </label>

            <label className="react-field">
              <span>Username</span>
              <div className="username-input-wrap">
                <span className="username-input-prefix">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().trim())
                  }
                  placeholder="username"
                  maxLength={30}
                />
              </div>
              {usernameStatus && (
                <small
                  className={`username-feedback ${
                    usernameStatus.includes("available")
                      ? "username-feedback--ok"
                      : "username-feedback--err"
                  }`}
                  role="status"
                >
                  {usernameStatus}
                </small>
              )}
            </label>

            <label className="react-field">
              <span>Bio</span>
              <textarea
                className="profile-editor__bio-input"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What do you build? What prompts do you care about?"
                maxLength={280}
              />
            </label>

            <div className="profile-editor__audience-section">
              <span className="profile-editor__field-label">
                Audience &amp; Discovery
              </span>
              <div
                className="profile-editor__choice-group"
                role="radiogroup"
                aria-label="Audience"
              >
                <label
                  className={`choice-card ${audience === "public" ? "choice-card--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="profile-audience"
                    value="public"
                    checked={audience === "public"}
                    onChange={() => setAudience("public")}
                  />
                  <div className="choice-card__body">
                    <strong>Public</strong>
                    <p>
                      Visible to anyone with the link and listed in the
                      community feed.
                    </p>
                  </div>
                </label>

                <label
                  className={`choice-card ${audience === "followers" ? "choice-card--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="profile-audience"
                    value="followers"
                    checked={audience === "followers"}
                    onChange={() => setAudience("followers")}
                  />
                  <div className="choice-card__body">
                    <strong>Followers only</strong>
                    <p>
                      Only approved followers can see your profile and prompts.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="profile-editor__footer">
          <div className="profile-editor__footer-left">
            {profile?.username && (
              <Link
                href={`/${profile.username}`}
                target="_blank"
                rel="noreferrer"
                className="profile-editor__view-link"
              >
                View public profile ↗
              </Link>
            )}
            {feedback && (
              <span
                className={`profile-editor__feedback ${
                  saveStatus === "error"
                    ? "profile-editor__feedback--error"
                    : "profile-editor__feedback--success"
                }`}
                role="status"
              >
                {feedback}
              </span>
            )}
          </div>

          <div className="profile-editor__footer-right">
            <LiquidButton
              type="submit"
              variant="primary"
              status={saveStatus}
              loadingText="Saving…"
              successText="Saved!"
              errorText="Failed to save"
            >
              Save profile
            </LiquidButton>
          </div>
        </div>
      </form>
    </section>
  );
}
