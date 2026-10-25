import { describe, expect, it } from "vitest";

import { nextOwner, type OwnershipEvent, type Owner } from "./ownership";

const table: [Owner, OwnershipEvent, Owner][] = [
  ["ai", "customer_requested", "human"],
  ["ai", "human_replied", "human"],
  ["ai", "handed_back", "ai"],
  ["ai", "conversation_ended", "ai"],
  ["human", "customer_requested", "human"],
  ["human", "human_replied", "human"],
  ["human", "handed_back", "ai"],
  ["human", "conversation_ended", "ai"],
];

describe("nextOwner", () => {
  it.each(table)("%s + %s -> %s", (owner, event, next) => {
    expect(nextOwner(owner, event)).toBe(next);
  });
});
