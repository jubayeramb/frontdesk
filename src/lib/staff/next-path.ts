// Only same-site /staff paths are allowed as a post-sign-in destination.
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/staff";
  if (!/^\/staff(\/[\w\-/]*)?$/.test(next)) return "/staff";
  if (next.startsWith("/staff/sign-in")) return "/staff";
  return next;
}

// The sign-in page's own `next`, read from the Referer of its form post. The
// form only knows `next` after hydration, so an early or script-free submit
// sends an empty value and the page address fills it in.
export function nextFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.pathname === "/staff/sign-in" ? url.searchParams.get("next") : null;
  } catch {
    return null;
  }
}
