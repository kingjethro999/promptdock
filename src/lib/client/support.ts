/** Where people can fund PromptDock. Mirrors .github/FUNDING.yml. */
export const SUPPORT_LINKS = [
  {
    id: "github",
    label: "GitHub Sponsors",
    href: "https://github.com/sponsors/kingjethro999",
  },
  {
    id: "thanks",
    label: "thanks.dev",
    href: "https://thanks.dev/u/gh/kingjethro999",
  },
] as const;

/** Reads a remembered UI preference; storage can be blocked or unavailable. */
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* The preference just will not persist. */
  }
}
