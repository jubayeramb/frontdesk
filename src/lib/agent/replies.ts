// What a turn returns. Channels decide how each kind looks.
export type ChoiceOption = { id: string; label: string };

export type AgentReply =
  | { kind: "text"; text: string }
  // `label` names the set in a few words ("View tours"), for channels that
  // need a control to open the options, such as WhatsApp's list button.
  | { kind: "choices"; prompt: string; label?: string; options: ChoiceOption[] }
  | { kind: "handoff"; text: string }
  | { kind: "link"; text: string; url: string; label: string };

export type ChoicesReply = Extract<AgentReply, { kind: "choices" }>;
