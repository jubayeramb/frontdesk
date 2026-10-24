import type { ChoiceOption } from "./replies";

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*?)\s*$/;

// The options go to the customer as their own reply, but the model sometimes
// lists them in its text as well. List lines that only repeat an option label
// are dropped, and a lead-in left ending in a colon ends in a full stop.
export function dropListedOptions(text: string, options: ChoiceOption[]): string {
  const labels = new Set(options.map((o) => normalize(o.label)));
  const lines = text.split("\n");
  const kept = lines.filter((line) => {
    const item = LIST_ITEM.exec(line)?.[1];
    // A trailing "(…)" is the model's own annotation, often an option id.
    return item === undefined || !labels.has(normalize(item.replace(/\*\*/g, "").replace(/\s*\([^)]*\)\s*$/, "")));
  });
  if (kept.length === lines.length) return text;
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/:$/, ".");
}

// The model sees option ids in its history as "(id: …)" and sometimes copies
// them into a reply. A customer never needs an id.
export function dropOptionIds(text: string): string {
  return text.replace(/\s*\((?:picked )?(?:option )?id:[^)]*\)/gi, "");
}

function normalize(label: string): string {
  return label.replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}
