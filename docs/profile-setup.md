# Community Profile Setup Flow (`/welcome`)

## Audit & Design Decisions

| Capability | Exists? (File) | Decision | Reason |
|---|---|---|---|
| User registration & auth | Yes (`src/components/auth/AuthForm.tsx`, `src/auth.js`) | **Extend** | Redirection safety net in workspace layout routes new accounts directly to `/welcome`. |
| Profile update API | Yes (`src/app/api/profile/route.ts`) | **Extend** | Added `bannerPreset` column and validation with mutual exclusivity against `banner_url`. |
| Image crop dialog | Yes (`src/components/community/ImageCropDialog.tsx`) | **Reuse** | Reused for avatar and custom banner image cropping. |
| Signed asset upload | Yes (`src/app/api/profile/assets/sign`, Cloudinary) | **Reuse** | Reused to store rasterized avatars and custom covers as authentic first-party URLs. |
| Avatar Generation | No | **Build New** (`AvatarPicker` with DiceBear 10) | Replaces third-party runtime avatar lookups with client-side deterministic CC0 SVG avatars. |

## Flow Overview

The `/welcome` stage is an interactive, step-by-step onboarding experience that replaces static forms with a live interactive public profile preview card:

1. **Step 1 - Name:**
   - Display name field prefilled with signup username.
   - Live character validation (max 60 chars, blocks spoofing and control characters).
   - Dynamic profile URL preview (`promptdock.com/username`).
2. **Step 2 - Photo (`AvatarPicker`):**
   - 8-tile radiogroup generated in the browser using DiceBear 10 CC0 styles (`lorelei`, `notionists`, `shapes`).
   - Seeds derived from `username:round:index`.
   - Brand background palette applied from PromptDock CSS tokens.
   - Shuffle button to cycle to next 8 options.
   - "Upload photo" button with built-in canvas cropper.
   - Letter avatar fallback option.
3. **Step 3 - Cover Banner:**
   - Palette presets (`moss`, `sage`, `sand`, `clay`, `slate`, `ink`).
   - "Upload photo" tile for custom cover images.
   - Setting preset clears custom banner URL, and vice versa.
4. **Step 4 - Bio:**
   - Textarea for bio (up to 160 characters).
   - Counter shown when within 40 characters of limit.
   - `Cmd/Ctrl + Enter` keyboard shortcut to continue.
5. **Step 5 - Done:**
   - Visual confirmation checkmark.
   - Primary action "Go to my workspace".
   - Link to view public profile.
   - Displays retryable error items if background saves experienced network errors.

## First-Party Analytics Queries

```sql
-- Profile setup funnel conversion
SELECT status, count(*) 
FROM user_experiences 
WHERE experience_id = 'profile-setup-v1' 
GROUP BY status;

-- Profiles with customized fields
SELECT 
  count(*) FILTER (WHERE avatar_url IS NOT NULL) AS with_photo,
  count(*) FILTER (WHERE banner_url IS NOT NULL OR banner_preset IS NOT NULL) AS with_cover,
  count(*) FILTER (WHERE bio IS NOT NULL AND bio <> '') AS with_bio,
  count(*) AS total_users
FROM users 
WHERE created_at >= '2026-10-12T00:00:00Z';
```
