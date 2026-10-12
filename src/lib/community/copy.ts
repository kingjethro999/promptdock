"use client";

/**
 * Copies the prompt text from the visibility-checked API endpoint.
 * Handles Safari's user activation constraints by passing a fetch Promise
 * directly to ClipboardItem.
 */
export async function copyPromptText(publicId: string): Promise<boolean> {
  const url = `/api/community/prompts/${publicId}/text`;
  try {
    if (typeof window !== "undefined" && typeof ClipboardItem !== "undefined") {
      const blob = fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return new Blob([await r.text()], { type: "text/plain" });
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": blob }),
      ]);
    } else if (typeof window !== "undefined" && navigator.clipboard) {
      const r = await fetch(url);
      if (!r.ok) return false;
      await navigator.clipboard.writeText(await r.text());
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
