import { randomUUID } from "node:crypto";

import type { Db } from "@/db/client";
import type { Channel } from "@/db/schema";
import { findOrCreateConversation } from "@/lib/conversations/store";

// A conversation for a fresh, made-up contact.
export function newConversation(db: Db, channel: Channel = "web") {
  return findOrCreateConversation(db, { channel, externalId: `test-${randomUUID()}` });
}
