// WhatsApp's customer service window: free-form messages may go out for 24
// hours after the customer's last message, and not at all before one.
export const REPLY_WINDOW_MS = 24 * 60 * 60_000;

// Milliseconds left in the window, 0 once it has closed.
export function windowRemaining(lastInboundAt: Date | null, now: Date): number {
  if (!lastInboundAt) return 0;
  return Math.max(0, lastInboundAt.getTime() + REPLY_WINDOW_MS - now.getTime());
}

// "3h 12m left", "3h left", "45m left", or "Window closed".
export function describeWindow(remainingMs: number): string {
  if (remainingMs <= 0) return "Window closed";
  const minutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m left`;
  return minutes % 60 === 0 ? `${hours}h left` : `${hours}h ${minutes % 60}m left`;
}
