// What a turn returns. Channels decide how each kind looks.
export type ChoiceOption = { id: string; label: string };

export type AgentReply =
  | { kind: "text"; text: string }
  | { kind: "choices"; prompt: string; options: ChoiceOption[] }
  | { kind: "handoff"; text: string }
  | { kind: "link"; text: string; url: string; label: string };

export type ChoicesReply = Extract<AgentReply, { kind: "choices" }>;
