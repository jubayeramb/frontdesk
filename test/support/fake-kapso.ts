// Stands in for Kapso's send API at the HTTP boundary, so the real SDK runs.
export type FakeKapso = {
  fetch: typeof fetch;
  // The JSON body of every send, in order.
  sends: Record<string, unknown>[];
  // Makes the nth send (0-based) fail with this status and body.
  failOn(n: number, status: number, body: unknown): void;
};

export function fakeKapso(): FakeKapso {
  const sends: Record<string, unknown>[] = [];
  const failures = new Map<number, { status: number; body: unknown }>();
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const n = sends.length;
    sends.push(JSON.parse(String(init?.body)));
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
    failOn: (n, status, body) => failures.set(n, { status, body }),
  };
}
