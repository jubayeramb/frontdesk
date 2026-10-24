import { expect, it } from "vitest";

import { safeNextPath } from "./next-path";

it.each([
  ["/staff/pricing", "/staff/pricing"],
  ["/staff", "/staff"],
  ["https://evil.example/staff", "/staff"],
  ["//evil.example", "/staff"],
  ["/staffing", "/staff"],
  ["/staff/sign-in", "/staff"],
  ["/staff/../admin", "/staff"],
  [undefined, "/staff"],
])("safeNextPath(%s) is %s", (input, expected) => {
  expect(safeNextPath(input)).toBe(expected);
});
