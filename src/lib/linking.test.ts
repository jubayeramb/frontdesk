import { describe, expect, it } from "vitest";

import { CODE_ALPHABET, findCode, generateCode, prefilledMessage, whatsappLink } from "./linking";

describe("generateCode", () => {
  it("makes TR- plus 6 characters from the alphabet, always with a letter", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^TR-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(code.slice(3)).toMatch(/[A-Z]/);
    }
  });
});

describe("findCode", () => {
  it("finds a code in the prefilled message", () => {
    expect(findCode(prefilledMessage("TR-7KQ2MX"))).toBe("TR-7KQ2MX");
  });

  it("ignores case and spaces after the dash, and reads look-alikes", () => {
    expect(findCode("my code is tr-7kq2mx")).toBe("TR-7KQ2MX");
    expect(findCode("TR- 7KQ2MX please")).toBe("TR-7KQ2MX");
    expect(findCode("TR-OIL2MX")).toBe("TR-0112MX");
  });

  it("returns null for text with no code", () => {
    expect(findCode("hi, how much is the Sylhet tour?")).toBeNull();
    expect(findCode("TR-7KQ2M")).toBeNull();
    expect(findCode("TR-7KQ2MXY")).toBeNull();
    expect(findCode("XTR-7KQ2MX")).toBeNull();
  });

  it("skips booking references, which are all digits", () => {
    expect(findCode("about booking TR-100006")).toBeNull();
    expect(findCode("booking TR-00006")).toBeNull();
  });

  it("takes the first of two codes", () => {
    expect(findCode("TR-AAAAAA or maybe TR-BBBBBB")).toBe("TR-AAAAAA");
  });

  it("skips a match with a character outside the alphabet", () => {
    expect(findCode("TR-UUUUUU then TR-7KQ2MX")).toBe("TR-7KQ2MX");
  });
});

describe("whatsappLink", () => {
  it("opens WhatsApp with the prefilled message", () => {
    expect(whatsappLink("15550000000", "TR-7KQ2MX")).toBe("https://wa.me/15550000000?text=Hi!%20My%20code%20is%20TR-7KQ2MX");
  });
});
