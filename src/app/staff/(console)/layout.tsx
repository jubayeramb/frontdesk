import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

// Static shell. Session checks happen inside each page's Suspense boundary
// (requireStaff), so this layout never blocks on the request.
export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            {/* The full name does not fit next to the links on a phone. */}
            <span className="font-semibold whitespace-nowrap">
              <span className="hidden sm:inline">Triplone Tours </span>
              <span className="sm:hidden">Staff</span>
              <span className="hidden sm:inline">staff</span>
            </span>
            <Link href="/staff" className="text-muted-foreground hover:text-foreground">
              Inbox
            </Link>
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
