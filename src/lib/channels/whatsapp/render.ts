import type { AgentReply, ChoiceOption } from "@/lib/agent/replies";
import type { OutboundMessage } from "../types";

// WhatsApp Cloud API limits.
export const LIMITS = {
  buttons: 3,
  buttonTitle: 20,
  listRows: 10,
  rowTitle: 24,
  rowDescription: 72,
  listButton: 20,
  interactiveBody: 1024,
  textBody: 4096,
} as const;

// For choices stored before they carried a label of their own.
const LIST_BUTTON = "Choose";

// More options than a list holds are sent as numbered text, and a reply with a
// number is read back against them.
export function isNumbered(options: ChoiceOption[]): boolean {
  return options.length > LIMITS.listRows;
}

export function render(reply: AgentReply): OutboundMessage[] {
  switch (reply.kind) {
    case "text":
    case "handoff":
      return textMessages(reply.text);
    case "link":
      return textMessages(`${reply.text}\n${reply.url}`);
    case "choices":
      return renderChoices(reply.prompt, reply.options, reply.label);
  }
}

function renderChoices(prompt: string, options: ChoiceOption[], label?: string): OutboundMessage[] {
  const body = cut(stripMarkdown(prompt), LIMITS.interactiveBody);
  // A button has nowhere to show a label it cuts, so long labels go in a list,
  // whose rows keep the full label as their description.
  if (options.length <= LIMITS.buttons && options.every((o) => o.label.length <= LIMITS.buttonTitle)) {
    return [
      {
        type: "buttons",
        body,
        buttons: options.map((o) => ({ id: o.id, title: o.label })),
      },
    ];
  }
  if (!isNumbered(options)) {
    return [
      {
        type: "list",
        body,
        button: cut(label ?? LIST_BUTTON, LIMITS.listButton),
        rows: options.map((o) => {
          const title = shorten(o.label, LIMITS.rowTitle);
          // A shortened title keeps the full label one line below it.
          return title === o.label
            ? { id: o.id, title }
            : { id: o.id, title, description: cut(o.label, LIMITS.rowDescription) };
        }),
      },
    ];
  }
  const lines = options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
  return textMessages(`${prompt}\n\n${lines}\n\nReply 1-${options.length}`);
}

function textMessages(text: string): OutboundMessage[] {
  return splitText(stripMarkdown(text), LIMITS.textBody).map((part) => ({ type: "text", text: part }));
}

// WhatsApp shows markdown literally, so it goes. Links become plain URLs.
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((\S+?)\)/g, (_, label: string, url: string) => (label === url ? url : `${label}: ${url}`))
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

const LONG_NAMES =
  /\b(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:s|nes|rs|ur)?day|(Jan)uary|(Feb)ruary|(Mar)ch|(Apr)il|(Jun)e|(Jul)y|(Aug)ust|(Sep)tember|(Oct)ober|(Nov)ember|(Dec)ember)\b/g;

// Shortens a label to `max` characters, keeping the part after the last comma
// (usually the date) whole: "Sundarbans 3-day, Thursday 6 November" becomes
// "Sundarbans…, Thu 6 Nov".
export function shorten(label: string, max: number): string {
  if (label.length <= max) return label;
  const short = label.replace(LONG_NAMES, (_, ...groups: unknown[]) =>
    String(groups.slice(0, 12).find((g) => typeof g === "string")),
  );
  if (short.length <= max) return short;

  const comma = short.lastIndexOf(", ");
  if (comma > 0) {
    const tail = short.slice(comma);
    if (tail.length < max - 4) return cut(short.slice(0, comma), max - tail.length) + tail;
  }
  return cut(short, max);
}

// Cuts at a word boundary when one is close, and marks the cut with an ellipsis.
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const space = room.lastIndexOf(" ");
  const kept = space >= max / 2 ? room.slice(0, space) : room;
  return `${kept.replace(/[\s,.;:-]+$/, "")}…`;
}

// Splits on paragraph, then line, then word boundaries so no part exceeds `max`.
export function splitText(text: string, max: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const at = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" ")].find(
      (i) => i > max / 2,
    );
    const end = at ?? max;
    parts.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}
