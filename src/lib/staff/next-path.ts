// Only same-site /staff paths are allowed as a post-sign-in destination.
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/staff";
  if (!/^\/staff(\/[\w\-/]*)?$/.test(next)) return "/staff";
  if (next.startsWith("/staff/sign-in")) return "/staff";
  return next;
}
