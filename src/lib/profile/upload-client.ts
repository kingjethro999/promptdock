export async function uploadProcessed(
  kind: "avatar" | "banner",
  blob: Blob,
): Promise<string> {
  const signRes = await fetch("/api/profile/assets/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => null);
    throw new Error(
      body?.error === "upload_provider_not_configured"
        ? "Photo uploads are switched off right now. Finish setting up and add a photo later from Settings."
        : signRes.status === 401
          ? "Sign in again to upload a photo."
          : "Could not start the upload. Try again in a moment.",
    );
  }
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
  if (!cloudRes.ok)
    throw new Error(
      "The photo did not upload. Check your connection, or try a smaller image.",
    );
  const cloudData = await cloudRes.json();
  return cloudData.secure_url;
}
