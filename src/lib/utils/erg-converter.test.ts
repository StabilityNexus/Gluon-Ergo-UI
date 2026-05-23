import { describe, it, expect } from "bun:test";
import {
  convertFromDecimals,
  convertToDecimals,
  formatMacroNumber,
  formatMicroNumber,
  formatNumber,
  nanoErgsToErgs,
  ergsToNanoErgs,
  UIFriendlyValue,
  APIFriendlyValue,
} from "./erg-converter";

describe("convertFromDecimals", () => {
  it("converts blockchain decimals to human-readable", () => {
    const result = convertFromDecimals(1_000_000_000n, 9);
    expect(result.toString()).toBe("1");
  });

  it("handles zero", () => {
    const result = convertFromDecimals(0, 9);
    expect(result.toString()).toBe("0");
  });

  it("handles string inputs", () => {
    const result = convertFromDecimals("5000000000", 9);
    expect(result.toString()).toBe("5");
  });
});

describe("convertToDecimals", () => {
  it("converts human-readable to blockchain decimals", () => {
    const result = convertToDecimals("1", 9);
    expect(result).toBe(1_000_000_000n);
  });

  it("handles zero", () => {
    const result = convertToDecimals("0", 9);
    expect(result).toBe(0n);
  });

  it("handles empty string by defaulting to zero", () => {
    const result = convertToDecimals("", 9);
    expect(result).toBe(0n);
  });

  it("rounds down fractional values", () => {
    const result = convertToDecimals("1.0000000001", 9);
    expect(result).toBe(1_000_000_000n);
  });
});

describe("formatMacroNumber", () => {
  it("formats thousands with K suffix", () => {
    const result = formatMacroNumber(1500);
    expect(result.display).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    const result = formatMacroNumber(2_500_000);
    expect(result.display).toBe("2.5M");
  });

  it("formats billions with B suffix", () => {
    const result = formatMacroNumber(3_200_000_000);
    expect(result.display).toBe("3.2B");
  });

  it("formats trillions with T suffix", () => {
    const result = formatMacroNumber(4_100_000_000_000);
    expect(result.display).toBe("4.1T");
  });

  it("handles zero", () => {
    const result = formatMacroNumber(0);
    expect(result.display).toBe("0");
  });

  it("provides full precision tooltip", () => {
    const result = formatMacroNumber(1234.5678);
    expect(result.tooltip).toBe("1,234.5678");
  });

  it("rounds down for crypto safety", () => {
    const result = formatMacroNumber(1999);
    expect(result.display).toBe("1.99K");
  });

  it("handles values under 1000", () => {
    const result = formatMacroNumber(999.567);
    expect(result.display).toBe("999.56");
  });
});

describe("formatMicroNumber", () => {
  it("formats small values with full precision", () => {
    const result = formatMicroNumber(0.000001234);
    expect(result.display).toBe("0.000001234");
  });

  it("handles zero", () => {
    const result = formatMicroNumber(0);
    expect(result.display).toBe("0");
  });

  it("removes trailing zeros", () => {
    const result = formatMicroNumber(1.5);
    expect(result.display).toBe("1.5");
  });

  it("truncates to 9 decimal places (rounds down)", () => {
    const result = formatMicroNumber(1.1234567899);
    expect(result.display).toBe("1.123456789");
  });

  it("provides full precision tooltip", () => {
    const result = formatMicroNumber(0.001);
    expect(result.tooltip).toBe("0.001000000");
  });
});

describe("formatNumber", () => {
  it("defaults to micro formatting", () => {
    const result = formatNumber(123.456);
    expect(result.display).toBe("123.456");
  });

  it("uses macro formatting when isMacro is true", () => {
    const result = formatNumber(1500, true);
    expect(result.display).toBe("1.5K");
  });
});

describe("nanoErgsToErgs", () => {
  it("converts nanoErgs to Ergs", () => {
    const result = nanoErgsToErgs(1_000_000_000n);
    expect(result.toString()).toBe("1");
  });

  it("handles zero", () => {
    const result = nanoErgsToErgs(0);
    expect(result.toString()).toBe("0");
  });
});

describe("ergsToNanoErgs", () => {
  it("converts Ergs to nanoErgs", () => {
    const result = ergsToNanoErgs("1");
    expect(result).toBe(1_000_000_000n);
  });

  it("converts fractional Ergs", () => {
    const result = ergsToNanoErgs("0.5");
    expect(result).toBe(500_000_000n);
  });
});

describe("UIFriendlyValue", () => {
  it("divides by default 10^9", () => {
    const result = UIFriendlyValue(1_000_000_000n);
    expect(result.toString()).toBe("1");
  });

  it("uses custom divisor", () => {
    const result = UIFriendlyValue(1000n, 3);
    expect(result.toString()).toBe("1");
  });
});

describe("APIFriendlyValue", () => {
  it("multiplies by default 10^9", () => {
    const result = APIFriendlyValue("1");
    expect(result).toBe(1_000_000_000n);
  });

  it("handles zero", () => {
    const result = APIFriendlyValue("0");
    expect(result).toBe(0n);
  });
});
