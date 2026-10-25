import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { env } from "@/env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function staffKeys() {
  return { secret: env.STAFF_SESSION_SECRET, password: env.STAFF_PASSWORD };
}

export async function isStaff(): Promise<boolean> {
  // Session expiry depends on the clock, so this never runs while prerendering.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, staffKeys(), new Date());
}

// Every staff page and action calls this; the proxy redirect is only a
// convenience. `returnTo` is where signing in again should land, the page the
// session ran out on.
export async function requireStaff(returnTo: string): Promise<void> {
  if (!(await isStaff())) redirect(`/staff/sign-in?next=${encodeURIComponent(returnTo)}`);
}
