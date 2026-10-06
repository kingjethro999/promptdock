export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iPhone or iPad"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "Mac"
        : /Android/.test(userAgent)
          ? "Android"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return platform ? `${browser} on ${platform}` : browser;
}
