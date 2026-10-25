import { randomInt } from "node:crypto";

import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";

import type { Db } from "@/db/client";
import { channelIdentities, contacts, conversations, linkCodes, messages, turns } from "@/db/schema";

// Crockford base32: digits and capitals without I, L, O and U.
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 6;
export const CODE_TTL_MS = 15 * 60_000;

// "TR-" then 6 characters, any case, spaces allowed after the dash. All-digit
// matches are skipped: they look like booking references, and codes always
// hold a letter.
const CODE_IN_TEXT = /\bTR-\s*([0-9A-Za-z]{6})\b/gi;

export function generateCode(): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (/[A-Z]/.test(code)) return `TR-${code}`;
  }
}

// The first code in the text, normalized, or null. Look-alikes are read the
// Crockford way: O as 0, I and L as 1.
export function findCode(text: string): string | null {
  for (const match of text.matchAll(CODE_IN_TEXT)) {
    const body = match[1]!.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
    if (!/[A-Z]/.test(body) || [...body].some((c) => !CODE_ALPHABET.includes(c))) continue;
    return `TR-${body}`;
  }
  return null;
}

export function prefilledMessage(code: string): string {
  return `Hi! My code is ${code}`;
}

export function whatsappLink(number: string, code: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(prefilledMessage(code))}`;
}

// The home page's WhatsApp button: a new conversation, so no code.
export const START_GREETING = "Hi! I'd like to ask about your tours.";

export function whatsappStartLink(number: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(START_GREETING)}`;
}

// A new code for a web conversation, valid for 15 minutes.
export async function createLinkCode(db: Db, conversationId: string, now: Date): Promise<string> {
  for (;;) {
    const code = generateCode();
    const [row] = await db
      .insert(linkCodes)
      .values({ code, conversationId, expiresAt: new Date(now.getTime() + CODE_TTL_MS) })
      .onConflictDoNothing()
      .returning({ code: linkCodes.code });
    if (row) return row.code;
  }
}

export type LinkResult = { linked: true; conversationId: string } | { linked: false };

// Uses a code for a WhatsApp number, in one transaction: the number moves to
// the web visitor's contact, its other open conversation is closed and kept,
// and the web conversation becomes the one WhatsApp continues. The guarded
// update makes a code work once even when two messages race.
export async function linkWhatsApp(
  db: Db,
  input: { code: string; whatsappNumber: string; displayName?: string; now: Date },
): Promise<LinkResult> {
  return db.transaction(async (tx) => {
    const [code] = await tx
      .update(linkCodes)
      .set({ usedAt: input.now })
      .where(and(eq(linkCodes.code, input.code), isNull(linkCodes.usedAt), gt(linkCodes.expiresAt, input.now)))
      .returning({ conversationId: linkCodes.conversationId });
    if (!code) {
      // A retry of a message that already used its code still counts.
      const [mine] = await tx
        .select({ conversationId: linkCodes.conversationId })
        .from(linkCodes)
        .innerJoin(channelIdentities, eq(channelIdentities.id, linkCodes.usedByIdentity))
        .where(and(eq(linkCodes.code, input.code), eq(channelIdentities.externalId, input.whatsappNumber)));
      return mine ? { linked: true, conversationId: mine.conversationId } : { linked: false };
    }

    const [web] = await tx
      .select({ id: conversations.id, contactId: conversations.contactId })
      .from(conversations)
      .where(eq(conversations.id, code.conversationId));
    if (!web) return { linked: false };

    // Point the number at the web contact, creating the identity if the number is new.
    const [existing] = await tx
      .select()
      .from(channelIdentities)
      .where(and(eq(channelIdentities.channel, "whatsapp"), eq(channelIdentities.externalId, input.whatsappNumber)));
    let identityId: number;
    if (existing) {
      identityId = existing.id;
      if (existing.contactId !== web.contactId) {
        await tx
          .update(conversations)
          .set({ closedAt: input.now, updatedAt: sql`now()` })
          .where(and(eq(conversations.contactId, existing.contactId), isNull(conversations.closedAt)));
        await tx.update(channelIdentities).set({ contactId: web.contactId }).where(eq(channelIdentities.id, existing.id));
        // The number's usage comes along, so linking never resets its limits.
        await tx.update(turns).set({ contactId: web.contactId }).where(eq(turns.contactId, existing.contactId));
      }
    } else {
      const [created] = await tx
        .insert(channelIdentities)
        .values({ contactId: web.contactId, channel: "whatsapp", externalId: input.whatsappNumber })
        .returning({ id: channelIdentities.id });
      identityId = created!.id;
    }
    await tx.update(linkCodes).set({ usedByIdentity: identityId }).where(eq(linkCodes.code, input.code));

    // A web visitor has no name; WhatsApp's profile name fills it in.
    if (input.displayName) {
      await tx
        .update(contacts)
        .set({ displayName: input.displayName })
        .where(and(eq(contacts.id, web.contactId), isNull(contacts.displayName)));
    }
    // Any other open conversation of the web contact is closed too, so the
    // linked one is the only one WhatsApp can continue.
    await tx
      .update(conversations)
      .set({ closedAt: input.now, updatedAt: sql`now()` })
      .where(and(eq(conversations.contactId, web.contactId), ne(conversations.id, web.id), isNull(conversations.closedAt)));
    await tx.insert(messages).values({
      conversationId: web.id,
      channel: "whatsapp",
      direction: "inbound",
      sentBy: "system",
      body: "Customer continued from the website on WhatsApp.",
      payload: { kind: "linked" },
    });
    return { linked: true, conversationId: web.id };
  });
}

