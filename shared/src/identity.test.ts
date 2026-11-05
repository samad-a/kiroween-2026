import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatRecoveryCode,
  generateRecoveryCode,
  parseGuestId,
  parseRecoveryCode,
  RECOVERY_CODE_LENGTH,
} from "./identity.js";

describe("parseGuestId", () => {
  it("accepts a well-formed uuid, lower-cased", () => {
    expect(parseGuestId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });

  it("rejects junk", () => {
    for (const bad of ["", "not-a-uuid", "123", 42, null, undefined, {}]) expect(parseGuestId(bad)).toBeNull();
  });
});

describe("recovery codes", () => {
  const AMBIGUOUS = /[O0I1]/;

  it("generates codes of the right length with no ambiguous characters", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.999999, noNaN: true }), (r) => {
        const code = generateRecoveryCode(() => r);
        expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(AMBIGUOUS.test(code)).toBe(false);
      }),
    );
  });

  it("parses what it generates, round-tripping through display form", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.999999, noNaN: true }), (r) => {
        const display = generateRecoveryCode(() => r);
        const canonical = parseRecoveryCode(display);
        expect(canonical).not.toBeNull();
        expect(canonical).toHaveLength(RECOVERY_CODE_LENGTH);
        expect(formatRecoveryCode(canonical!)).toBe(display);
      }),
    );
  });

  it("is forgiving about dashes, case and spaces", () => {
    // Uses only alphabet symbols (no ambiguous 0/O/1/I — note O is excluded too).
    expect(parseRecoveryCode("mane-7823")).toBe("MANE7823");
    expect(parseRecoveryCode("MANE 7823")).toBe("MANE7823");
    expect(parseRecoveryCode("MANE7823")).toBe("MANE7823");
  });

  it("drops ambiguous characters a user might type by mistake", () => {
    // 0/O/1/I are not in the alphabet, so a code with them is too short -> null.
    expect(parseRecoveryCode("MO0N-7821")).toBeNull();
  });

  it("rejects wrong-length or junk codes", () => {
    for (const bad of ["", "MOON", "MOON74211", 42, null, undefined]) expect(parseRecoveryCode(bad)).toBeNull();
  });
});
