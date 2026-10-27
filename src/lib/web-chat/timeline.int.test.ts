import { describe, expect, it } from "vitest";

import { findOrCreateConversation } from "@/lib/conversations/store";
import { setupTestDb } from "../../../test/int/db";
import { maskedWhatsApp } from "./timeline";

const db = setupTestDb();

describe("maskedWhatsApp", () => {
  it("is null for a contact who never wrote on WhatsApp", async () => {
    const web = await findOrCreateConversation(db, { channel: "web", externalId: "visitor-1" });
    expect(await maskedWhatsApp(db, web.contactId)).toBeNull();
  });

  it("shows the number's last 4 digits, even when a user id is stored too", async () => {
    const wa = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "BD.1000000000000001", otherIds: ["8801700004821"] });
    expect(await maskedWhatsApp(db, wa.contactId)).toBe("WhatsApp •••• 4821");
  });

  it("shows no digits for a contact known only by user id", async () => {
    const wa = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "BD.1000000000000002" });
    expect(await maskedWhatsApp(db, wa.contactId)).toBe("WhatsApp");
  });
});
