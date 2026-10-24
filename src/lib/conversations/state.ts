import type { Quote } from "@/lib/pricing/quote";

// What the agent remembers beyond the message window. Written only by tools.
export type ConversationState = {
  quote?: Quote;
  booking?: {
    id: number;
    tourSlug: string;
    tourName: string;
    departsOn: string;
    label: string;
    travelers: number;
    totalBdt: number;
  };
};
