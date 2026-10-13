export async function uploadProcessed(
  kind: "avatar" | "banner",
  blob: Blob,
): Promise<string> {
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
  return cloudData.secure_url;
}
