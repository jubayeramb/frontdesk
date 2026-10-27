// One Kapso event, however it was delivered.
export type KapsoEvent = {
  type: string;
  dedupeKey: string;
  // The customer: their business-scoped user id if Kapso sent one, else their
  // WhatsApp number, digits only.
  partitionKey: string;
  phoneNumberId: string | null;
  payload: Record<string, unknown>;
};

export type Normalized =
  | { kind: "events"; events: KapsoEvent[] }
  // Kapso's test button and test API: their sender is our own number, so
  // answering one would have the agent message itself.
  | { kind: "test" }
  | { kind: "invalid"; reason: string };

type Payload = Record<string, unknown> & {
  message?: { id?: unknown; from?: unknown; to?: unknown; from_user_id?: unknown; to_user_id?: unknown };
  conversation?: { id?: unknown; phone_number?: unknown; business_scoped_user_id?: unknown };
  phone_number_id?: unknown;
};

// Who an event is about. Meta reports a customer who has a WhatsApp username
// by a business-scoped user id ("BD.…") and may leave the phone number out.
export type Customer = { phone?: string; userId?: string };

export function customerOf(payload: Payload): Customer {
  const phone = [payload.conversation?.phone_number, payload.message?.from, payload.message?.to]
    .map((v) => (typeof v === "string" ? v.replace(/\D/g, "") : ""))
    .find(Boolean);
  const userId = [payload.conversation?.business_scoped_user_id, payload.message?.from_user_id, payload.message?.to_user_id].find(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return { ...(phone && { phone }), ...(userId && { userId }) };
}

// The ids a customer is stored under, the user id first.
export function customerIds(customer: Customer): string[] {
  return [customer.userId, customer.phone].filter((v): v is string => !!v);
}

// Where a reply goes: the number every earlier send used, else the user id.
export function customerAddress(customer: Customer): string {
  return customer.phone ?? customer.userId!;
}

// A buffered delivery is `{ type, batch: true, data: [...] }`; anything else is
// a single event whose type is in the X-Webhook-Event header.
export function normalize(body: unknown, eventHeader: string | null): Normalized {
  if (!isObject(body)) return { kind: "invalid", reason: "body is not an object" };
  if (body.test === true) return { kind: "test" };

  const batch = body.batch === true && Array.isArray(body.data);
  const type = batch ? body.type : eventHeader;
  if (typeof type !== "string" || !type) return { kind: "invalid", reason: "no event type" };

  const payloads = batch ? (body.data as unknown[]) : [body];
  const events: KapsoEvent[] = [];
  for (const payload of payloads) {
    if (!isObject(payload)) return { kind: "invalid", reason: "event is not an object" };
    const event = toEvent(type, payload as Payload);
    if (!event) return { kind: "invalid", reason: `cannot key a ${type} event` };
    events.push(event);
  }
  return { kind: "events", events };
}

function toEvent(type: string, payload: Payload): KapsoEvent | null {
  // One idempotency header covers a whole batch, so each event is keyed by
  // what it is about: the message, or the conversation for conversation events.
  const subject = type.startsWith("whatsapp.conversation.") ? payload.conversation?.id : payload.message?.id;
  // The user id first: it stays when Meta stops sending the phone number.
  const [partitionKey] = customerIds(customerOf(payload));
  if (typeof subject !== "string" || !partitionKey) return null;
  return {
    type,
    dedupeKey: `${type}:${subject}`,
    partitionKey,
    phoneNumberId: typeof payload.phone_number_id === "string" ? payload.phone_number_id : null,
    payload,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
