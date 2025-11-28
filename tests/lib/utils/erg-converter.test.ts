import { describe, expect, test } from "bun:test";
import BigNumber from "bignumber.js";
import {
    convertFromDecimals,
    convertToDecimals,
    formatMacroNumber,
    formatMicroNumber,
    formatApprox,
    format,
    formatNumber,
    nanoErgsToErgs,
    ergsToNanoErgs,
    UIFriendlyValue,
    APIFriendlyValue,
} from "@/lib/utils/erg-converter";

describe("convertFromDecimals", () => {
    test("should convert from decimals with default 9 decimals", () => {
        const result = convertFromDecimals(1000000000);
        expect(result.toString()).toBe("1");
    });

    test("should convert from decimals with custom decimals", () => {
        const result = convertFromDecimals(1000, 3);
        expect(result.toString()).toBe("1");
    });

    test("should handle bigint input", () => {
        const result = convertFromDecimals(BigInt(5000000000));
        expect(result.toString()).toBe("5");
    });

    test("should handle string input", () => {
        const result = convertFromDecimals("2000000000");
        expect(result.toString()).toBe("2");
    });

    test("should handle zero", () => {
        const result = convertFromDecimals(0);
        expect(result.toString()).toBe("0");
    });

    test("should handle very large numbers", () => {
        const result = convertFromDecimals("1000000000000000000"); // 1 billion ERG
        expect(result.toString()).toBe("1000000000");
    });
});

describe("convertToDecimals", () => {
    test("should convert to decimals with default 9 decimals", () => {
        const result = convertToDecimals(1);
        expect(result.toString()).toBe("1000000000");
    });

    test("should convert to decimals with custom decimals", () => {
        const result = convertToDecimals(1, 3);
        expect(result.toString()).toBe("1000");
    });

    test("should handle string input", () => {
        const result = convertToDecimals("2.5");
        expect(result.toString()).toBe("2500000000");
    });

    test("should handle zero", () => {
        const result = convertToDecimals(0);
        expect(result.toString()).toBe("0");
    });

    test("should handle empty string as zero", () => {
        const result = convertToDecimals("");
        expect(result.toString()).toBe("0");
    });

    test("should handle null/undefined as zero", () => {
        const result1 = convertToDecimals(null as any);
        const result2 = convertToDecimals(undefined as any);
        expect(result1.toString()).toBe("0");
        expect(result2.toString()).toBe("0");
    });

    test("should handle NaN as zero", () => {
        const result = convertToDecimals(NaN);
        expect(result.toString()).toBe("0");
    });

    test("should round down decimal values", () => {
        const result = convertToDecimals("1.123456789123");
        expect(result.toString()).toBe("1123456789");
    });
});

describe("formatMacroNumber", () => {
    test("should format zero", () => {
        const result = formatMacroNumber(0);
        expect(result.display).toBe("0");
        expect(result.tooltip).toBe("0");
        expect(result.raw).toBe("0");
    });

    test("should format numbers less than 1000", () => {
        const result = formatMacroNumber(500);
        expect(result.display).toBe("500");
    });

    test("should format thousands with K suffix", () => {
        const result = formatMacroNumber(5000);
        expect(result.display).toBe("5K");
    });

    test("should format millions with M suffix", () => {
        const result = formatMacroNumber(5000000);
        expect(result.display).toBe("5M");
    });

    test("should format billions with B suffix", () => {
        const result = formatMacroNumber(5000000000);
        expect(result.display).toBe("5B");
    });

    test("should format trillions with T suffix", () => {
        const result = formatMacroNumber(5000000000000);
        expect(result.display).toBe("5T");
    });

    test("should round down to 2 decimal places", () => {
        const result = formatMacroNumber(1234567);
        expect(result.display).toBe("1.23M");
    });

    test("should handle BigNumber input", () => {
        const result = formatMacroNumber(new BigNumber(1500000));
        expect(result.display).toBe("1.5M");
    });

    test("should handle string input", () => {
        const result = formatMacroNumber("2500000");
        expect(result.display).toBe("2.5M");
    });

    test("should provide tooltip with formatted number", () => {
        const result = formatMacroNumber(1234567);
        expect(result.tooltip).toBe("1,234,567");
    });
});

describe("formatMicroNumber", () => {
    test("should format zero", () => {
        const result = formatMicroNumber(0);
        expect(result.display).toBe("0");
    });

    test("should format whole numbers", () => {
        const result = formatMicroNumber(100);
        expect(result.display).toBe("100");
    });

    test("should format decimal numbers", () => {
        const result = formatMicroNumber(1.5);
        expect(result.display).toBe("1.5");
    });

    test("should remove trailing zeros", () => {
        const result = formatMicroNumber(1.5000);
        expect(result.display).toBe("1.5");
    });

    test("should handle up to 9 decimal places", () => {
        const result = formatMicroNumber(1.123456789);
        expect(result.display).toBe("1.123456789");
    });

    test("should truncate beyond 9 decimal places", () => {
        const result = formatMicroNumber(1.123456789123);
        expect(result.display).toBe("1.123456789");
    });

    test("should handle very small numbers", () => {
        const result = formatMicroNumber(0.000000001);
        expect(result.display).toBe("0.000000001");
    });

    test("should handle BigNumber input", () => {
        const result = formatMicroNumber(new BigNumber("1.23456"));
        expect(result.display).toBe("1.23456");
    });
});

describe("formatApprox", () => {
    test("should return macro formatted display value", () => {
        const result = formatApprox(5000000);
        expect(result).toBe("5M");
    });
});

describe("format", () => {
    test("should return micro formatted display value", () => {
        const result = format(1.5);
        expect(result).toBe("1.5");
    });
});

describe("formatNumber", () => {
    test("should use micro formatting by default", () => {
        const result = formatNumber(1.5);
        expect(result.display).toBe("1.5");
    });

    test("should use macro formatting when isMacro is true", () => {
        const result = formatNumber(5000000, true);
        expect(result.display).toBe("5M");
    });
});

describe("nanoErgsToErgs", () => {
    test("should convert nanoErgs to Ergs", () => {
        const result = nanoErgsToErgs(1000000000);
        expect(result.toString()).toBe("1");
    });

    test("should handle bigint input", () => {
        const result = nanoErgsToErgs(BigInt(5000000000));
        expect(result.toString()).toBe("5");
    });

    test("should handle string input", () => {
        const result = nanoErgsToErgs("2000000000");
        expect(result.toString()).toBe("2");
    });

    test("should handle zero", () => {
        const result = nanoErgsToErgs(0);
        expect(result.toString()).toBe("0");
    });
});

describe("ergsToNanoErgs", () => {
    test("should convert Ergs to nanoErgs", () => {
        const result = ergsToNanoErgs(1);
        expect(result.toString()).toBe("1000000000");
    });

    test("should handle string input", () => {
        const result = ergsToNanoErgs("2.5");
        expect(result.toString()).toBe("2500000000");
    });

    test("should handle zero", () => {
        const result = ergsToNanoErgs(0);
        expect(result.toString()).toBe("0");
    });

    test("should round down decimal values", () => {
        const result = ergsToNanoErgs("1.123456789123");
        expect(result.toString()).toBe("1123456789");
    });
});

describe("UIFriendlyValue", () => {
    test("should convert with default 9 decimals", () => {
        const result = UIFriendlyValue(1000000000);
        expect(result.toString()).toBe("1");
    });

    test("should convert with custom divisor", () => {
        const result = UIFriendlyValue(1000, 3);
        expect(result.toString()).toBe("1");
    });

    test("should handle bigint input", () => {
        const result = UIFriendlyValue(BigInt(5000000000));
        expect(result.toString()).toBe("5");
    });
});

describe("APIFriendlyValue", () => {
    test("should convert with default 9 decimals", () => {
        const result = APIFriendlyValue(1);
        expect(result.toString()).toBe("1000000000");
    });

    test("should convert with custom divisor", () => {
        const result = APIFriendlyValue(1, 3);
        expect(result.toString()).toBe("1000");
    });

    test("should handle string input", () => {
        const result = APIFriendlyValue("2.5");
        expect(result.toString()).toBe("2500000000");
    });
});
