"use client";

import { useSyncExternalStore } from "react";

import { describeWindow, windowRemaining } from "@/lib/reply-window";
import { cn } from "@/lib/utils";

// One clock for every countdown on the page, ticking each minute. It is only
// read in the browser: the server renders at `loadedAt`.
let listeners: (() => void)[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let minute = 0;

function clock() {
  if (minute === 0) minute = Date.now();
  return minute;
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  if (!timer) {
    minute = Date.now();
    timer = setInterval(() => {
      minute = Date.now();
      for (const l of listeners) l();
    }, 60_000);
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

// Time left in WhatsApp's 24-hour reply window. Hydrates at the moment the
// server read the data, so the markup matches, then follows the browser's clock.
export function ReplyWindow({
  lastInboundAt,
  loadedAt,
  className,
}: {
  // Epoch milliseconds.
  lastInboundAt: number | null;
  loadedAt: number;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, clock, () => loadedAt);
  const remaining = windowRemaining(lastInboundAt === null ? null : new Date(lastInboundAt), new Date(now));
  return (
    <span
      data-testid="reply-window"
      className={cn(remaining > 0 ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-400", className)}
    >
      {remaining > 0 ? `Reply window: ${describeWindow(remaining)}` : "Window closed"}
    </span>
  );
}
