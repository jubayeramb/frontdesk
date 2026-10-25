import Link from "next/link";

// The demo banner and the public pages' navigation. "Chat" is a plain link to
// /#chat, which the chat panel opens on, so it also works from /c.
export function SiteHeader() {
  return (
    <>
      <p className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        Demo business. No real bookings.
      </p>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="font-semibold whitespace-nowrap">
            Triplone Tours
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm sm:gap-5">
            {/* A plain link, so on / it fires hashchange; Link changes the hash without the event. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/#chat" className="text-muted-foreground hover:text-foreground">
              Chat
            </a>
            <Link href="/c" className="text-muted-foreground hover:text-foreground">
              Conversation
            </Link>
            <Link href="/staff" className="text-muted-foreground hover:text-foreground">
              Staff
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
