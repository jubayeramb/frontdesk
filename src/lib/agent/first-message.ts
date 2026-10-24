// gpt-oss sometimes keeps writing after its answer. The extra messages arrive
// run together with no space between them ("...to book?Let me know..."), so
// a sentence end followed straight by a capital letter marks where the first
// message ended. Only that first message is kept.
export function firstMessage(text: string): string {
  const glued = /[.!?](?=[A-Z])/.exec(text);
  return glued ? text.slice(0, glued.index + 1) : text;
}
