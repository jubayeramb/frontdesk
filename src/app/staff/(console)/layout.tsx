import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

// Static shell. Session checks happen inside each page's Suspense boundary
// (requireStaff), so this layout never blocks on the request.
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <span className="font-semibold">Triplone Tours staff</span>
            <Link href="/staff/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
