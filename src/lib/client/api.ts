export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json"))
    throw new ApiError(
      "The site API returned an invalid response.",
      response.status,
    );
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new ApiError(
      result.error || "The request could not be completed.",
      response.status,
    );
  return result;
}

export function json<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  return api<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
