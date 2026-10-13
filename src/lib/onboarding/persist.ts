export function record(
  id: string,
  status: "shown" | "completed" | "skipped" | "dismissed",
  step: number,
) {
  if (typeof window === "undefined") return Promise.resolve();
  return fetch(`/api/experiences/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, step }),
    keepalive: true,
  }).catch(() => {});
}
