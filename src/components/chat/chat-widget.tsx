"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "cn";
import { ExternalLink, MessageCircle, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgentReply, ChoiceOption } from "@/lib/agent/replies";
import {
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
  type ChatTranscriptResponse,
  type ChatTurnResponse,
} from "@/lib/web-chat/types";
import { RichText } from "./rich-text";

// A visitor message keeps its nonce until the server answers, so a retry is
// the same message to the server, not a second one.
type Line = ChatMessage & { nonce?: string; status?: "sending" | "failed" };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [history, setHistory] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone();

  const busy = lines.some((line) => line.status === "sending");

  // The transcript loads the first time the panel opens, so a reload picks up
  // where the visitor left off.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next || history !== "idle") return;
    setHistory("loading");
    fetch("/api/chat")
      .then((response) => (response.ok ? (response.json() as Promise<ChatTranscriptResponse>) : Promise.reject()))
      .then((transcript) => {
        setLines((current) => [...transcript.messages, ...current]);
        setHistory("loaded");
      })
      .catch(() => setHistory("failed"));
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, open]);

  const run = useCallback(async (line: Line) => {
    setLines((current) => current.map((l) => (l.id === line.id ? { ...l, status: "sending" } : l)));
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nonce: line.nonce,
          text: line.reply.kind === "text" ? line.reply.text : undefined,
          choiceId: line.choiceId,
        }),
      });
      if (!response.ok) throw new Error(`chat request failed with ${response.status}`);
      const { replies } = (await response.json()) as ChatTurnResponse;
      setLines((current) => [
        ...current.map((l) => (l.id === line.id ? { ...l, status: undefined } : l)),
        ...replies.map((reply, i): Line => ({ id: `${line.nonce}-${i}`, from: "agent", reply })),
      ]);
      setAnnouncement(replies.map(spoken).join(" "));
    } catch {
      setLines((current) => current.map((l) => (l.id === line.id ? { ...l, status: "failed" } : l)));
      setAnnouncement("Couldn't send. Try again.");
    }
  }, []);

  const send = useCallback(
    (text: string, choiceId?: string) => {
      const nonce = crypto.randomUUID();
      const line: Line = { id: nonce, nonce, from: "visitor", reply: { kind: "text", text }, choiceId, status: "sending" };
      setLines((current) => [...current, line]);
      void run(line);
      inputRef.current?.focus();
    },
    [run],
  );

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    send(text);
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <Dialog.Root
        open={open}
        onOpenChange={changeOpen}
        modal={isPhone}
        // On a desktop the panel stays open while the visitor reads the page.
        disablePointerDismissal={!isPhone}
      >
        <Dialog.Trigger
          render={<Button size="lg" />}
          className="fixed right-4 bottom-4 z-40 h-12 rounded-full px-5 shadow-lg"
        >
          <MessageCircle aria-hidden className="size-5" />
          Chat with us
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup
            initialFocus={inputRef}
            className={cn(
              "fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none",
              "sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(640px,calc(100dvh-2rem))] sm:w-[400px]",
              "sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-2xl",
            )}
          >
            <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <Dialog.Title className="font-semibold">Triplone Tours front desk</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Quotes, departures and bookings. Demo only.
                </Dialog.Description>
              </div>
              <Dialog.Close render={<Button variant="ghost" size="icon" />} aria-label="Close chat">
                <X aria-hidden />
              </Dialog.Close>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
              <AgentBubble>
                <p>Hi! Ask about a tour, a price for your group or the next departures.</p>
              </AgentBubble>
              {history === "failed" && (
                <p className="text-center text-sm text-muted-foreground">Couldn&apos;t load earlier messages.</p>
              )}
              {lines.map((line, index) => (
                <LineView
                  key={line.id}
                  line={line}
                  picked={pickedAfter(lines, index)}
                  active={index === lines.length - 1 && !busy}
                  onPick={(option) => send(option.label, option.id)}
                  onRetry={() => void run(line)}
                />
              ))}
              {busy && <TypingIndicator />}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="flex gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                aria-label="Message"
                placeholder="Ask about a tour or a price"
                autoComplete="off"
                className="h-10"
              />
              <Button type="submit" size="icon-lg" className="size-10" aria-label="Send" disabled={busy || !draft.trim()}>
                <SendHorizontal aria-hidden />
              </Button>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function LineView({
  line,
  picked,
  active,
  onPick,
  onRetry,
}: {
  line: Line;
  picked?: string;
  active: boolean;
  onPick: (option: ChoiceOption) => void;
  onRetry: () => void;
}) {
  if (line.from === "visitor") {
    const text = line.reply.kind === "choices" ? line.reply.prompt : line.reply.text;
    return (
      <div className="flex flex-col items-end gap-1">
        <p
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground",
            line.status === "sending" && "opacity-70",
          )}
        >
          {text}
        </p>
        {line.status === "failed" && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            Couldn&apos;t send. Try again.
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </p>
        )}
      </div>
    );
  }
  return <ReplyView reply={line.reply} picked={picked} active={active} onPick={onPick} />;
}

function ReplyView({
  reply,
  picked,
  active,
  onPick,
}: {
  reply: AgentReply;
  picked?: string;
  active: boolean;
  onPick: (option: ChoiceOption) => void;
}) {
  switch (reply.kind) {
    case "text":
      return (
        <AgentBubble>
          <RichText text={reply.text} />
        </AgentBubble>
      );
    case "handoff":
      return (
        <AgentBubble className="border border-dashed bg-transparent">
          <RichText text={reply.text} />
        </AgentBubble>
      );
    case "link":
      return (
        <AgentBubble>
          <RichText text={reply.text} />
          <a
            href={reply.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            {reply.label}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </AgentBubble>
      );
    case "choices":
      return (
        <div className="space-y-1.5">
          <p aria-hidden className="text-xs text-muted-foreground">
            {reply.prompt}
          </p>
          <div role="group" aria-label={reply.prompt} className="flex flex-wrap gap-2">
            {reply.options.map((option) => (
              <Button
                key={option.id}
                variant={picked === option.id ? "default" : "outline"}
                size="sm"
                // The pick stays at full strength; only the options not taken fade.
                className={cn("h-auto min-h-8 py-1.5 whitespace-normal", picked === option.id && "disabled:opacity-100")}
                aria-pressed={picked === option.id}
                disabled={!active}
                onClick={() => onPick(option)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      );
  }
}

function AgentBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm", className)}>{children}</div>
  );
}

function TypingIndicator() {
  return (
    <div role="status" aria-label="Front desk is typing" className="flex w-fit gap-1 rounded-2xl bg-muted px-3 py-3">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

// The option the visitor's next message picked, if it picked one.
function pickedAfter(lines: Line[], index: number): string | undefined {
  const next = lines[index + 1];
  return next?.from === "visitor" ? next.choiceId : undefined;
}

function spoken(reply: AgentReply): string {
  switch (reply.kind) {
    case "choices":
      return `${reply.prompt}. ${reply.options.length} options.`;
    case "link":
      return `${reply.text} ${reply.label}.`;
    default:
      return reply.text;
  }
}

const PHONE_QUERY = "(max-width: 639px)";

// Phones get a full-screen modal sheet; wider screens a panel beside the page.
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
