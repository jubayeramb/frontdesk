"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/staff/next-path";
import { signIn, type SignInState } from "../actions";

// Rendered once, in the static shell, so the form works before hydration and
// there is never a second copy of it in a Suspense fallback.
export function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Suspense fallback={<input type="hidden" name="next" value="/staff" />}>
        <NextPathInput />
      </Suspense>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Staff password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "password-error" : undefined}
        />
        {state.error ? (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function NextPathInput() {
  const next = safeNextPath(useSearchParams().get("next"));
  return <input type="hidden" name="next" value={next} />;
}
