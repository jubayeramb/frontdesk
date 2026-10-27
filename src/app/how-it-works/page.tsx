import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { ACCESS_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works | Triplone Tours (demo)",
  description: "How Front Desk runs one AI agent on web chat and WhatsApp through Kapso, and what tripped me up building it.",
};

const REPO_URL = "https://github.com/jubayeramb/frontdesk";

export default function HowItWorks() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How Front Desk works</h1>
        <div className="mt-4 space-y-4 text-lg text-muted-foreground">
          <p>
            Front Desk is one AI agent that answers Triplone Tours&apos; customers on web chat and WhatsApp.
            WhatsApp runs through Kapso, and a person can take over any conversation from Kapso&apos;s inbox.
          </p>
          <p>
            This page covers how it&apos;s built and what tripped me up on Kapso.
            The code is on{" "}
            <a href={REPO_URL} className="text-foreground underline underline-offset-4">
              GitHub
            </a>
            , and you can{" "}
            <Link href="/" className="text-foreground underline underline-offset-4">
              try the demo
            </Link>
            .
          </p>
        </div>

        <figure className="mt-10">
          <Image
            src="/architecture.svg"
            width={440}
            height={692}
            alt="Web chat and Kapso webhooks pass the guards into one agent core, which reads Postgres through tools; replies go out through the web or WhatsApp adapter."
            className="mx-auto h-auto w-full max-w-110"
            priority
          />
          <figcaption className="mt-3 text-center text-sm text-muted-foreground">
            One agent core between two channels. Only the adapters know which channel a reply is for.
          </figcaption>
        </figure>

        <Section id="channels" title="One agent, two channels">
          <p>
            The agent never imports anything channel-specific.
            The only channel-aware input is one line in its prompt.
            It returns a list of replies: plain text, or a choice with options.
          </p>
          <p>
            The adapters decide how a reply looks.
            The web shows options as buttons and renders markdown.
            WhatsApp gets reply buttons for up to 3 options, a list for up to 10, and numbered text beyond that, with no markdown.
            A number typed back is read against the options that were sent.
          </p>
          <p>
            A visitor can start on the web and continue on WhatsApp.
            The site gives them a code like <Code>TR-7K2M9Q</Code> in a prefilled message, valid for 15 minutes, which joins both channels into one conversation.
          </p>
        </Section>

        <Section id="prices" title="Prices come from the database">
          <p>
            The model never states a price on its own.
            Tools take the raw inputs (tour, number of travelers, departure) and do the math in code.
          </p>
          <p>
            A price guard checks every reply.
            If it contains an amount that no tool returned this turn, and that isn&apos;t the stored quote or booking, the reply is replaced with one built from the quote.
          </p>
          <p>
            A booking needs the customer&apos;s own pick: a tapped option, a number, or a day and month in their latest message.
            Anything else books nothing and offers the departures again.
          </p>
          <p>
            The agent runs on <Code>gpt-oss-120b</Code> on Groq at temperature 0.2.
            On a 429, a 5xx or a network error, it moves to <Code>gpt-oss-20b</Code>.
            A turn uses about 1.4K to 2.1K input tokens, and the model sees the last 20 messages.
          </p>
        </Section>

        <Section id="webhooks" title="The webhook pipeline">
          <p>
            Kapso delivers at least once, and Vercel functions can stop as soon as the response is sent.
            So the webhook route does as little as it can before replying.
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Verify the HMAC signature on the raw body.</li>
            <li>
              Store each event once, keyed by event type and message id.
              Kapso&apos;s idempotency key can&apos;t be the key, because a batch shares one.
            </li>
            <li>Reply 200.</li>
            <li>
              In <Code>after()</Code>, drain each customer&apos;s events one at a time, in the order they arrived.
              A transaction-scoped advisory lock keeps two workers off the same customer.
            </li>
          </ol>
          <p>
            A failed event is retried by the same drain after 5 seconds, then 10, and marked failed after 3 attempts.
            A retried message that is already stored gets the parts its first attempt didn&apos;t finish, never a second reply.
          </p>
          <p>
            Every outbound message is stored as pending, with a nonce, before it goes out.
            Then it gets the WhatsApp id or the error.
          </p>
        </Section>

        <Section id="handoff" title="Handing off to a person">
          <p>
            Staff use Kapso&apos;s inbox, embedded at <Code>/staff</Code> next to a list of conversations and who owns each one.
            A reply from the inbox takes the conversation over, and the agent stays quiet.
            &quot;Hand back to AI&quot;, or Kapso ending the conversation, gives it back.
          </p>
          <p>
            The hard part is noticing the inbox reply.
            Kapso sends <Code>whatsapp.message.sent</Code> for it, and that event looks the same as one for the app&apos;s own sends.
            So the message id decides: an outbound message the app never sent is a person.
          </p>
          <p>
            The app&apos;s own send can arrive as an event before its send call returns the id.
            While one of its sends is still waiting for an id, an unknown message is checked again for up to 15 seconds before it counts as a person.
          </p>
        </Section>

        <Section id="window" title="The 24-hour reply window">
          <p>
            WhatsApp only allows free-form replies within 24 hours of the customer&apos;s last message.
            One function decides whether a reply can go out, and it runs again when the turn is ready, since a slow turn can cross the line.
          </p>
          <p>
            A reply that is too late is stored as blocked, with the reason.
            The customer&apos;s page and <Code>/staff</Code> show the time left, or &quot;Window closed&quot;.
          </p>
        </Section>

        <Section id="limits" title="Staying inside the free tier">
          <p>
            Groq&apos;s free tier gave each model 1,000 requests a day and 8,000 tokens a minute.
            A turn takes about 3 requests, so one model covers about 330 turns a day.
          </p>
          <p>
            Guards run before every model call.
            Each contact gets 20 turns an hour and 60 a day across both channels, and everyone together gets 250 a day.
            A message from a conversation a person owns, or one that isn&apos;t text, never reaches the model.
          </p>
          <p>
            Conversations with no activity for 7 days are deleted by a daily cron.
          </p>
        </Section>

        <Section id="kapso" title="What tripped me up on Kapso">
          <p>
            None of these stopped the build, but each one changed a design decision.
            Every item comes from my build notes, with the payloads to back it.
          </p>
          <ul className="mt-6 space-y-6">
            {TRIPS.map((trip, i) => (
              <li key={i} className="rounded-xl border p-4 sm:p-5">
                <h3 className="font-medium">{trip.title}</h3>
                <p className="mt-2 text-muted-foreground">{trip.what}</p>
                <p className="mt-2">
                  <span className="font-medium">What I did: </span>
                  {trip.did}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="whatsapp-access" title="Trying it on WhatsApp">
          <p>
            WhatsApp runs on Kapso&apos;s sandbox number, which only answers phones registered for it in the Kapso dashboard.
            Email{" "}
            <a href={`mailto:${ACCESS_EMAIL}`} className="text-foreground underline underline-offset-4">
              {ACCESS_EMAIL}
            </a>{" "}
            and I&apos;ll add yours.
            The web chat works for everyone.
          </p>
        </Section>

        <p className="mt-16 border-t pt-6 text-muted-foreground">
          <Link href="/" className="text-foreground underline underline-offset-4">
            Try the demo
          </Link>{" "}
          or read the{" "}
          <a href={REPO_URL} className="text-foreground underline underline-offset-4">
            code on GitHub
          </a>
          .
        </p>
      </main>
    </div>
  );
}

const TRIPS: { title: React.ReactNode; what: React.ReactNode; did: React.ReactNode }[] = [
  {
    title: "An inbox reply looks the same as an API send",
    what: (
      <>
        Both arrive as <Code>whatsapp.message.sent</Code>, and the payloads differ only in content, ids and timestamps.
        There&apos;s no field or header saying who sent it.
      </>
    ),
    did: "Every send is stored before it goes out, so an outbound id the app doesn't know is a person.",
  },
  {
    title: (
      <>
        <Code>message.sent</Code> drops <Code>biz_opaque_callback_data</Code>
      </>
    ),
    what: "Every send sets it to the app's own nonce, and Meta's status webhooks carry it, but Kapso's v2 event doesn't include it.",
    did: "Without it, a send can't be recognized before its id is stored, so unknown messages wait up to 15 seconds while a send is in flight.",
  },
  {
    title: "Turning on buffering for an existing webhook does nothing",
    what: (
      <>
        The update returns <Code>buffer_enabled: true</Code>, but messages keep arriving one per delivery.
        A webhook created with buffering on batches correctly.
      </>
    ),
    did: "I left buffering off. Draining each customer in order already handles quick bursts.",
  },
  {
    title: "One idempotency key covers a whole batch",
    what: (
      <>
        <Code>X-Idempotency-Key</Code> is stable across retries, but every event in a batch shares it.
      </>
    ),
    did: "Events are deduped by event type and message id instead.",
  },
  {
    title: "Timestamps have one-second resolution",
    what: "Three messages sent within a second shared a timestamp, and Kapso's inbox showed them as B, A, C while the webhooks arrived as A, B, C.",
    did: "Events are ordered by when they arrived, never by the WhatsApp timestamp.",
  },
  {
    title: (
      <>
        Inbound messages are labelled <Code>cloud_api</Code>
      </>
    ),
    what: (
      <>
        <Code>message.kapso.origin</Code> is <Code>cloud_api</Code> for customer messages too, though the docs define it as sent through Kapso&apos;s API.
      </>
    ),
    did: "Direction comes from the event type, not the origin field.",
  },
  {
    title: (
      <>
        <Code>conversation.ended</Code> doesn&apos;t say why
      </>
    ),
    what: "The payload has no reason field, so a manual close from the inbox looks the same as an inactivity timeout.",
    did: "Any end gives the conversation back to the agent.",
  },
  {
    title: "A late reply fails at send time, not as an event",
    what: (
      <>
        A free-form send outside the 24-hour window gets a 422 straight away, and no <Code>whatsapp.message.failed</Code> follows.
      </>
    ),
    did: "The app checks the window itself, and a 422 is stored as a blocked send.",
  },
  {
    title: "Message ids carry the phone number",
    what: "WhatsApp message ids embed the customer's number in base64.",
    did: "Log masking and the test fixtures hide message ids as well as phone numbers.",
  },
  {
    title: "The sandbox fails its own health check",
    what: (
      <>
        <Code>kapso whatsapp numbers health</Code> reports the sandbox as unhealthy, with token and app id errors, while it delivers every message.
      </>
    ),
    did: "I ignore the check for the sandbox and test delivery directly.",
  },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 space-y-4 leading-7">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-[0.9em] wrap-break-word">{children}</code>;
}
