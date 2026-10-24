"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { staffKeys } from "@/lib/staff/auth";
import { safeNextPath } from "@/lib/staff/next-path";
import {
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/staff/session";

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const keys = staffKeys();
  const attempt = formData.get("password");
  if (typeof attempt !== "string" || !passwordMatches(attempt, keys.password)) {
    return { error: "Wrong password." };
  }
  (await cookies()).set(SESSION_COOKIE, createSessionToken(keys, new Date()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/staff",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/staff" });
  redirect("/staff/sign-in");
}
