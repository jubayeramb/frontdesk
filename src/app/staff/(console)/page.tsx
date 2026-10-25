import type { Metadata } from "next";
import { Suspense } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { ReplyWindow } from "@/components/reply-window";
import { db } from "@/db";
import { env } from "@/env";
import { requireStaff } from "@/lib/staff/auth";
import { listHandedOver, type HandedOver } from "@/lib/staff/conversations";
import { HandBackButton } from "./hand-back-button";

export const metadata: Metadata = { title: "Inbox | Triplone Tours staff" };

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Reply to WhatsApp customers here. A reply takes the conversation over from the agent until you hand it back.
        </p>
      </div>
      {/* The fallback is static; the inbox address only renders after the session check. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading conversations...</p>}>
        <StaffInbox />
      </Suspense>
    </div>
  );
}

async function StaffInbox() {
  await requireStaff("/staff");
  const handedOver = await listHandedOver(db);
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <AutoRefresh everyMs={5000} />
      <section aria-labelledby="handed-over" className="flex min-w-0 flex-col gap-3">
        <h2 id="handed-over" className="text-sm font-medium text-muted-foreground">
          With a person{handedOver.length > 0 && ` (${handedOver.length})`}
        </h2>
        {handedOver.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Nobody is waiting. The agent is answering every conversation.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {handedOver.map((c) => (
              <HandedOverRow key={c.id} conversation={c} />
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Kapso inbox" className="min-w-0">
        {env.KAPSO_INBOX_EMBED_URL ? (
          <iframe
            src={env.KAPSO_INBOX_EMBED_URL}
            title="Kapso inbox"
            className="h-[70dvh] w-full rounded-xl border bg-background lg:h-[calc(100dvh-12rem)] lg:min-h-[32rem]"
            allow="clipboard-write"
          />
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            The inbox is not set up. Run <code>pnpm inbox:embed --origin http://localhost:3000 --write-env .env.local</code>{" "}
            and restart the server.
          </p>
        )}
      </section>
    </div>
  );
}

function HandedOverRow({ conversation: c }: { conversation: HandedOver }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3" data-testid="handed-over-row">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{c.who}</span>
        <time dateTime={c.since.toISOString()} className="shrink-0 text-xs text-muted-foreground">
          {time.format(c.since)}
        </time>
      </div>
      <p className="text-sm first-letter:uppercase">{c.because}</p>
      {c.whatsapp && (
        <ReplyWindow lastInboundAt={c.whatsapp.lastInboundAt?.getTime() ?? null} loadedAt={c.whatsapp.loadedAt.getTime()} className="text-xs" />
      )}
      {c.preview && (
        <p className="line-clamp-2 text-sm break-words text-muted-foreground">
          {c.lastFrom === "customer" ? "" : c.lastFrom === "human" ? "You: " : "Agent: "}
          {c.preview}
        </p>
      )}
      <HandBackButton conversationId={c.id} />
    </li>
  );
}
