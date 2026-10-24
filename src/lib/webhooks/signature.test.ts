import { describe, expect, it } from "vitest";

import { FIXTURE_SECRET, kapsoFixture } from "../../../test/support/kapso-fixtures";
import { verifySignature } from "./signature";

const { body, headers } = kapsoFixture("message-received-text");
const signature = headers["x-webhook-signature"]!;

describe("verifySignature", () => {
  it("accepts a fixture signed with the webhook secret", () => {
    expect(verifySignature(body, signature, FIXTURE_SECRET)).toBe(true);
  });

  it("rejects the wrong secret or a changed body", () => {
    expect(verifySignature(body, signature, "another-secret")).toBe(false);
    expect(verifySignature(body.replace("Hello", "Hellp"), signature, FIXTURE_SECRET)).toBe(false);
  });

  it("rejects a missing, non-hex or wrong-length signature", () => {
    expect(verifySignature(body, null, FIXTURE_SECRET)).toBe(false);
    expect(verifySignature(body, "", FIXTURE_SECRET)).toBe(false);
    expect(verifySignature(body, "z".repeat(64), FIXTURE_SECRET)).toBe(false);
    expect(verifySignature(body, signature.slice(0, 62), FIXTURE_SECRET)).toBe(false);
    expect(verifySignature(body, `${signature}00`, FIXTURE_SECRET)).toBe(false);
  });

  it("verifies every captured fixture", () => {
    for (const name of ["message-received-batch", "message-received-list-reply", "conversation-ended", "message-sent-inbox-reply"]) {
      const fixture = kapsoFixture(name);
      expect(verifySignature(fixture.body, fixture.headers["x-webhook-signature"]!, FIXTURE_SECRET)).toBe(true);
    }
  });
});
