import { describe, expect, it } from "vitest";

import { nextFromReferer, safeNextPath } from "./next-path";

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

describe("nextFromReferer", () => {
  it("reads next from the sign-in page address", () => {
    expect(nextFromReferer("http://localhost:3000/staff/sign-in?next=%2Fstaff%2Fpricing")).toBe("/staff/pricing");
  });

  it("ignores other pages, a missing header and garbage", () => {
    expect(nextFromReferer("http://localhost:3000/staff/pricing?next=%2Fstaff")).toBeNull();
    expect(nextFromReferer(null)).toBeNull();
    expect(nextFromReferer("not a url")).toBeNull();
  });
});
