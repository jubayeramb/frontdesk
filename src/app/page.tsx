import { cn } from "cn";
import { ExternalLink, MessageCircle } from "lucide-react";

import { ChatWidget } from "@/components/chat/chat-widget";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_TOURS } from "@/db/seed-data";
import { env } from "@/env";
import { whatsappStartLink } from "@/lib/linking";

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

// Prices are left to the chat, so the page never shows one the database disagrees with.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
        <section className="py-16 sm:py-24">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Triplone Tours</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Small-group tours across Bangladesh, leaving from Dhaka.
            Ask the front desk for a price for your group, here or on WhatsApp, pick a departure and book.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#chat" className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}>
              <MessageCircle aria-hidden />
              Chat on the website
            </a>
            <a
              href={whatsappStartLink(env.NEXT_PUBLIC_WHATSAPP_NUMBER)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-4")}
            >
              Chat on WhatsApp
              <ExternalLink aria-hidden />
            </a>
          </div>
        </section>

        <section aria-labelledby="tours" className="space-y-6">
          <h2 id="tours" className="text-2xl font-semibold tracking-tight">
            Tours
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {DEFAULT_TOURS.map((tour) => (
              <li key={tour.slug} className="flex">
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle className="text-base">
                      <h3>{tour.name}</h3>
                    </CardTitle>
                    <CardDescription>
                      {tour.days} days, leaves {listOf(tour.departureWeekdays.map((d) => WEEKDAYS[d]!))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">{tour.summary}</CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Prices are per person and depend on how many of you are going.
            Ask the chat for a quote.
          </p>
        </section>

        <section aria-labelledby="how-to-book" className="mt-16 space-y-6">
          <h2 id="how-to-book" className="text-2xl font-semibold tracking-tight">
            How booking works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Step {i + 1}</p>
                <h3 className="mt-1 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* Bottom padding keeps the chat button off the last line. */}
      <footer className="border-t pt-6 pb-24 text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-1 px-4 sm:px-6">
          <p>Chats are stored for 7 days and then deleted.</p>
          <p>WhatsApp messages also go through Kapso, our WhatsApp provider, which keeps its own copy.</p>
          <p>This is a demo, so don&apos;t send personal details like your phone number, address or ID.</p>
          <p>The front desk is an AI agent and can get things wrong.</p>
        </div>
      </footer>

      <ChatWidget whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_NUMBER} />
    </div>
  );
}

const STEPS = [
  {
    title: "Ask for a price",
    body: "Tell the front desk which tour and how many of you are going. The total comes from the current price list.",
  },
  {
    title: "Pick a departure",
    body: "The next dates show up as buttons. Tap the one that suits you.",
  },
  {
    title: "Book",
    body: "You get a booking reference like TR-00012. Nothing is charged and nobody will call you.",
  },
];

function listOf(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : (items[0] ?? "");
}
