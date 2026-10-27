/**
 * @file amounts.test.ts
 * @description Unit tests for toBaseUnits and formatUnits precision conversions.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import { toBaseUnits, formatUnits } from "@/lib/utils/amounts";

describe("amounts.ts", () => {
  describe("round trips across 0, 3, and 9 decimals", () => {
    it("handles 0 decimals", () => {
      const input = "123456";
      const base = toBaseUnits(input, 0);
      expect(base).toBe(123456n);
      expect(formatUnits(base, 0)).toBe(input);
    });

    it("handles 3 decimals", () => {
      const input = "123.456";
      const base = toBaseUnits(input, 3);
      expect(base).toBe(123456n);
      expect(formatUnits(base, 3)).toBe(input);

      // Trailing zeroes format cleanly
      expect(formatUnits(toBaseUnits("123.400", 3), 3)).toBe("123.4");
      expect(formatUnits(toBaseUnits("123.000", 3), 3)).toBe("123");
    });

    it("handles 9 decimals (Ergo nanoErg precision)", () => {
      const input = "1.000000001";
      const base = toBaseUnits(input, 9);
      expect(base).toBe(1000000001n);
      expect(formatUnits(base, 9)).toBe(input);

      const largeNano = "987654321.123456789";
      const baseLarge = toBaseUnits(largeNano, 9);
      expect(baseLarge).toBe(987654321123456789n);
      expect(formatUnits(baseLarge, 9)).toBe(largeNano);
    });
  });

  describe("values above 2^53 (lossless BigInt arithmetic)", () => {
    it("converts numbers larger than Number.MAX_SAFE_INTEGER without precision loss", () => {
      // 2^53 = 9,007,199,254,740,992
      const hugeInput = "9007199254740992123456789.987654321";
      const expectedBigInt = 9007199254740992123456789987654321n;

      const base = toBaseUnits(hugeInput, 9);
      expect(base).toBe(expectedBigInt);
      expect(formatUnits(base, 9)).toBe(hugeInput);
    });
  });

  describe("edge cases and invalid inputs", () => {
    it("handles zero and empty strings", () => {
      expect(toBaseUnits("0", 9)).toBe(0n);
      expect(toBaseUnits("", 9)).toBe(0n);
      expect(toBaseUnits("   ", 9)).toBe(0n);
      expect(formatUnits(0n, 9)).toBe("0");
    });

    it("truncates fractional digits exceeding decimals", () => {
      // 4 fractional digits with decimals=3 -> truncates the 4th digit
      expect(toBaseUnits("1.2349", 3)).toBe(1234n);
    });

    it("throws on invalid string format", () => {
      expect(() => toBaseUnits("abc", 9)).toThrow();
      expect(() => toBaseUnits("1.2.3", 9)).toThrow();
    });

    it("handles negative values", () => {
      const input = "-1.5";
      const base = toBaseUnits(input, 9);
      expect(base).toBe(-1500000000n);
      expect(formatUnits(base, 9)).toBe(input);
      expect(formatUnits(-1n, 9)).toBe("-0.000000001");
    });
  });
});
