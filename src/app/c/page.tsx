import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { RichText } from "@/components/chat/rich-text";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { env } from "@/env";
import { cn } from "@/lib/utils";
import { CHAT_COOKIE, verifyConversationCookie } from "@/lib/web-chat/cookie";
import { loadTimeline, type Timeline, type TimelineEntry } from "@/lib/web-chat/timeline";

export const metadata: Metadata = {
  title: "Your conversation | Triplone Tours (demo)",
  robots: { index: false },
};

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default function ConversationPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your conversation</h1>
          <p className="text-sm text-muted-foreground">Everything from the website chat and WhatsApp, in one place.</p>
        </div>
        {/* Reads the chat cookie, so it renders per request inside the boundary. */}
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your conversation...</p>}>
          <VisitorTimeline />
        </Suspense>
      </main>
    </div>
  );
}

async function VisitorTimeline() {
  // A prefetch can see the cookie too; the database is only read per request.
  await connection();
  const conversationId = verifyConversationCookie((await cookies()).get(CHAT_COOKIE)?.value, env.CHAT_COOKIE_SECRET);
  const timeline = conversationId ? await loadTimeline(db, conversationId) : null;
  if (!timeline || timeline.entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm">
        <p className="font-medium">No conversation yet</p>
        <p className="mt-1 text-muted-foreground">
          <Link href="/#chat" className="underline underline-offset-4 hover:text-foreground">
            Start one in the chat
          </Link>{" "}
          on the home page, and it shows up here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh everyMs={5000} />
      <Status timeline={timeline} />
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {timeline.entries.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </ol>
    </div>
  );
}

function Status({ timeline }: { timeline: Timeline }) {
  const person = timeline.owner === "human";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm" data-testid="timeline-status">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          person
            ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {person ? "Person" : "Agent"}
      </span>
      <span>{person ? "A person will reply." : "The front desk agent is answering."}</span>
      {timeline.whatsapp && <span className="text-muted-foreground">WhatsApp {timeline.whatsapp}</span>}
    </div>
  );
}

function Entry({ entry }: { entry: TimelineEntry }) {
  const meta = (
    <span className="text-xs text-muted-foreground">
      {entry.channel === "whatsapp" ? "WhatsApp" : "Web"} · <time dateTime={entry.at.toISOString()}>{time.format(entry.at)}</time>
    </span>
  );
  if (entry.from === "note") {
    return (
      <li className="flex flex-col items-center gap-0.5 py-1 text-center text-xs text-muted-foreground">
        <span className="font-medium">{entry.text}</span>
        {meta}
      </li>
    );
  }
  const mine = entry.from === "you";
  return (
    <li className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")} data-testid="timeline-entry">
      <span className="text-xs font-medium text-muted-foreground">
        {mine ? "You" : entry.from === "person" ? "Triplone Tours team" : "Front desk agent"}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words",
          mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
        )}
      >
        {mine ? <p className="whitespace-pre-wrap">{entry.text}</p> : <RichText text={entry.text} />}
        {entry.options && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Options offered">
            {entry.options.map((option) => (
              <li key={option} className="rounded-lg border bg-background px-2 py-1 text-xs">
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
      {meta}
    </li>
  );
}
