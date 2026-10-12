import { createHash, randomUUID } from "node:crypto";
export class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message || String(status));
    this.status = status;
  }
}

export const LIMITS = {
  avatar: { maxBytes: 2_000_000 },
  banner: { maxBytes: 4_000_000 },
} as const;

/** Trust bytes, not the filename or the client's content-type. SVG is rejected on purpose. */
export function sniffImage(
  b: Uint8Array,
): "image/png" | "image/jpeg" | "image/webp" | null {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export type UploadKind = "avatar" | "banner";

export type SignedUploadPayload = {
  uploadUrl: string;
  fields: {
    api_key: string;
    timestamp: number;
    signature: string;
    folder: string;
    public_id: string;
    [key: string]: string | number;
  };
  maxBytes: number;
  allowedTypes: string[];
};

export function signCloudinaryUpload(
  userId: string,
  kind: UploadKind,
): SignedUploadPayload {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    throw new HttpError(500, "upload_provider_not_configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `community/${userId}`;
  const publicId = `${kind}-${randomUUID()}`;

  // Cloudinary signature: sort params alphabetically, join with &, append apiSecret, sha1
  const paramsToSign = [
    `folder=${folder}`,
    `public_id=${publicId}`,
    `timestamp=${timestamp}`,
  ]
    .sort()
    .join("&");

  const signature = createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: {
      api_key: apiKey,
      timestamp,
      signature,
      folder,
      public_id: publicId,
    },
    maxBytes: LIMITS[kind].maxBytes,
    allowedTypes: ["image/png", "image/jpeg", "image/webp"],
  };
}

export function assertOwnedAsset(url: string, userId: string) {
  if (!url || typeof url !== "string") {
    throw new HttpError(400, "bad_asset");
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HttpError(400, "bad_asset");
  }

  const expectedHost = process.env.COMMUNITY_ASSET_HOST || "res.cloudinary.com";
  if (u.protocol !== "https:" || u.host !== expectedHost) {
    throw new HttpError(400, "bad_asset");
  }
  if (!u.pathname.includes(`/community/${userId}/`)) {
    throw new HttpError(400, "bad_asset");
  }
}
