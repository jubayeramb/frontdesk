// Stands in for Kapso's send API at the HTTP boundary, so the real SDK runs.
export type FakeKapso = {
  fetch: typeof fetch;
  // The JSON body of every send, in order.
  sends: Record<string, unknown>[];
  // Read receipts (with or without a typing indicator), in order.
  receipts: Record<string, unknown>[];
  // Every request body in arrival order, sends and receipts together.
  log: Record<string, unknown>[];
  // Makes the nth send (0-based) fail with this status and body.
  failOn(n: number, status: number, body: unknown): void;
  // Makes every read receipt fail with this status and body.
  failReceipts(status: number, body: unknown): void;
};

export function fakeKapso(): FakeKapso {
  const sends: Record<string, unknown>[] = [];
  const receipts: Record<string, unknown>[] = [];
  const log: Record<string, unknown>[] = [];
  const failures = new Map<number, { status: number; body: unknown }>();
  let receiptFailure: { status: number; body: unknown } | undefined;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    log.push(body);
    if (body.status === "read") {
      receipts.push(body);
      if (receiptFailure) return Response.json(receiptFailure.body, { status: receiptFailure.status });
      return Response.json({ success: true });
    }
    const n = sends.length;
    sends.push(body);
    const failure = failures.get(n);
    if (failure) return Response.json(failure.body, { status: failure.status });
    return Response.json({
      messaging_product: "whatsapp",
      contacts: [{ input: "8801700000000", wa_id: "8801700000000" }],
      messages: [{ id: `wamid.fake-${n + 1}` }],
    });
  };
  return {
    fetch: fetchImpl as typeof fetch,
    sends,
    receipts,
    log,
    failOn: (n, status, body) => failures.set(n, { status, body }),
    failReceipts: (status, body) => (receiptFailure = { status, body }),
  };
}
