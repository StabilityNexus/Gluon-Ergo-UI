import { describe, it, expect } from "bun:test";
import { normalizeActionType } from "./indexed-db";

describe("normalizeActionType", () => {
  it("returns fission as-is", () => {
    expect(normalizeActionType("fission")).toBe("fission");
  });

  it("returns fusion as-is", () => {
    expect(normalizeActionType("fusion")).toBe("fusion");
  });

  it("returns transmute-to-{peg} as-is", () => {
    expect(normalizeActionType("transmute-to-gold")).toBe("transmute-to-gold");
  });

  it("returns transmute-from-{peg} as-is", () => {
    expect(normalizeActionType("transmute-from-gold")).toBe("transmute-from-gold");
  });

  it("normalizes transmute-to-gold", () => {
    expect(normalizeActionType("transmute-to-gold")).toBe("transmute-to-gold");
  });

  it("normalizes volatile-to-stable", () => {
    const result = normalizeActionType("volatile-to-stable");
    expect(result).toBe("transmute-to-gold");
  });

  it("normalizes transmute-from-gold", () => {
    expect(normalizeActionType("transmute-from-gold")).toBe("transmute-from-gold");
  });

  it("normalizes stable-to-volatile", () => {
    const result = normalizeActionType("stable-to-volatile");
    expect(result).toBe("transmute-from-gold");
  });

  it("returns null for unknown action types", () => {
    expect(normalizeActionType("unknown-action")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeActionType("")).toBeNull();
  });
});
