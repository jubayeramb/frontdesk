import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isStaff } from "@/lib/staff/auth";
import { safeNextPath } from "@/lib/staff/next-path";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Staff sign-in | Triplone Tours (demo)" };

export default function SignInPage({ searchParams }: PageProps<"/staff/sign-in">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Triplone Tours staff</CardTitle>
          <CardDescription>Sign in to edit prices and answer customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}

// Renders nothing; sends staff who are already signed in straight through.
async function RedirectIfSignedIn({
  searchParams,
}: Pick<PageProps<"/staff/sign-in">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  if (await isStaff()) redirect(next);
  return null;
}
