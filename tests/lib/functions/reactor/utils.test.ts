import { describe, expect, test } from "bun:test";
import BigNumber from "bignumber.js";
import {
    getValidToTokens,
    getActionType,
    getDescription,
    getTitle,
    validateAmount,
    formatValue,
    defaultTokens,
    VALID_PAIRS,
} from "@/lib/functions/reactor/utils";
import type { Token, TokenSymbol } from "@/lib/functions/reactor/types";

describe("VALID_PAIRS", () => {
    test("should have correct valid pairs", () => {
        expect(VALID_PAIRS).toHaveLength(4);
        expect(VALID_PAIRS).toContainEqual({ from: "ERG", to: "GAU-GAUC" });
        expect(VALID_PAIRS).toContainEqual({ from: "GAU-GAUC", to: "ERG" });
        expect(VALID_PAIRS).toContainEqual({ from: "GAU", to: "GAUC" });
        expect(VALID_PAIRS).toContainEqual({ from: "GAUC", to: "GAU" });
    });
});

describe("defaultTokens", () => {
    test("should have 4 default tokens", () => {
        expect(defaultTokens).toHaveLength(4);
    });

    test("should include ERG token", () => {
        const erg = defaultTokens.find(t => t.symbol === "ERG");
        expect(erg).toBeDefined();
        expect(erg?.name).toBe("Ergo");
        expect(erg?.decimals).toBe(9);
    });

    test("should include GAU token", () => {
        const gau = defaultTokens.find(t => t.symbol === "GAU");
        expect(gau).toBeDefined();
        expect(gau?.name).toBe("Gluon Gold");
        expect(gau?.decimals).toBe(9);
    });

    test("should include GAUC token", () => {
        const gauc = defaultTokens.find(t => t.symbol === "GAUC");
        expect(gauc).toBeDefined();
        expect(gauc?.name).toBe("Gluon Gold Certificate");
        expect(gauc?.decimals).toBe(9);
    });

    test("should include GAU-GAUC pair token", () => {
        const pair = defaultTokens.find(t => t.symbol === "GAU-GAUC");
        expect(pair).toBeDefined();
        expect(pair?.name).toBe("Gluon Pair");
        expect(pair?.decimals).toBe(9);
    });
});

describe("getValidToTokens", () => {
    test("should return GAU-GAUC for ERG", () => {
        const result = getValidToTokens("ERG", defaultTokens);
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe("GAU-GAUC");
    });

    test("should return ERG for GAU-GAUC", () => {
        const result = getValidToTokens("GAU-GAUC", defaultTokens);
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe("ERG");
    });

    test("should return GAUC for GAU", () => {
        const result = getValidToTokens("GAU", defaultTokens);
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe("GAUC");
    });

    test("should return GAU for GAUC", () => {
        const result = getValidToTokens("GAUC", defaultTokens);
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe("GAU");
    });

    test("should return empty array for invalid symbol", () => {
        const result = getValidToTokens("INVALID" as TokenSymbol, defaultTokens);
        expect(result).toHaveLength(0);
    });
});

describe("getActionType", () => {
    test("should return erg-to-gau-gauc for ERG to GAU-GAUC", () => {
        const result = getActionType("ERG", "GAU-GAUC");
        expect(result).toBe("erg-to-gau-gauc");
    });

    test("should return gau-gauc-to-erg for GAU-GAUC to ERG", () => {
        const result = getActionType("GAU-GAUC", "ERG");
        expect(result).toBe("gau-gauc-to-erg");
    });

    test("should return gauc-to-gau for GAUC to GAU", () => {
        const result = getActionType("GAUC", "GAU");
        expect(result).toBe("gauc-to-gau");
    });

    test("should return gau-to-gauc for GAU to GAUC", () => {
        const result = getActionType("GAU", "GAUC");
        expect(result).toBe("gau-to-gauc");
    });

    test("should return null for invalid pair", () => {
        const result = getActionType("ERG", "GAU");
        expect(result).toBeNull();
    });

    test("should return null for same token", () => {
        const result = getActionType("ERG", "ERG");
        expect(result).toBeNull();
    });
});

describe("getDescription", () => {
    test("should return fission description for erg-to-gau-gauc", () => {
        const result = getDescription("erg-to-gau-gauc");
        expect(result).toContain("fission");
        expect(result).toContain("ERG");
        expect(result).toContain("GAU");
        expect(result).toContain("GAUC");
    });

    test("should return fusion description for gau-gauc-to-erg", () => {
        const result = getDescription("gau-gauc-to-erg");
        expect(result).toContain("fusion");
        expect(result).toContain("GAU");
        expect(result).toContain("GAUC");
        expect(result).toContain("ERG");
    });

    test("should return transmutation description for gauc-to-gau", () => {
        const result = getDescription("gauc-to-gau");
        expect(result).toContain("transmutation");
        expect(result).toContain("GAUC");
        expect(result).toContain("GAU");
    });

    test("should return transmutation description for gau-to-gauc", () => {
        const result = getDescription("gau-to-gauc");
        expect(result).toContain("transmutation");
        expect(result).toContain("GAU");
        expect(result).toContain("GAUC");
    });

    test("should return default description for null", () => {
        const result = getDescription(null);
        expect(result).toBe("Select tokens to swap.");
    });
});

describe("getTitle", () => {
    test("should return FISSION for erg-to-gau-gauc", () => {
        const result = getTitle("erg-to-gau-gauc");
        expect(result).toBe("FISSION");
    });

    test("should return FUSION for gau-gauc-to-erg", () => {
        const result = getTitle("gau-gauc-to-erg");
        expect(result).toBe("FUSION");
    });

    test("should return TRANSMUTATION for gauc-to-gau", () => {
        const result = getTitle("gauc-to-gau");
        expect(result).toBe("TRANSMUTATION");
    });

    test("should return TRANSMUTATION for gau-to-gauc", () => {
        const result = getTitle("gau-to-gauc");
        expect(result).toBe("TRANSMUTATION");
    });

    test("should return REACTOR for null", () => {
        const result = getTitle(null);
        expect(result).toBe("REACTOR");
    });
});

describe("validateAmount", () => {
    test("should return error for empty string", () => {
        const result = validateAmount("");
        expect(result).toBe("Amount cannot be empty");
    });

    test("should return error for invalid number", () => {
        const result = validateAmount("abc");
        expect(result).toBe("Invalid number");
    });

    test("should return error for zero", () => {
        const result = validateAmount("0");
        expect(result).toBe("Amount must be greater than 0");
    });

    test("should return error for negative number", () => {
        const result = validateAmount("-5");
        expect(result).toBe("Amount must be greater than 0");
    });

    test("should return null for valid positive number", () => {
        const result = validateAmount("10");
        expect(result).toBeNull();
    });

    test("should return null for valid decimal number", () => {
        const result = validateAmount("10.5");
        expect(result).toBeNull();
    });

    test("should return null for very small positive number", () => {
        const result = validateAmount("0.000001");
        expect(result).toBeNull();
    });

    test("should return null for very large number", () => {
        const result = validateAmount("1000000000");
        expect(result).toBeNull();
    });
});

describe("formatValue", () => {
    test("should return 0 for undefined", () => {
        const result = formatValue(undefined);
        expect(result).toBe("0");
    });

    test("should return 0 for NaN", () => {
        const result = formatValue(NaN);
        expect(result).toBe("0");
    });

    test("should format number correctly", () => {
        const result = formatValue(123.456);
        expect(result).toBe("123.456");
    });

    test("should format BigNumber correctly", () => {
        const result = formatValue(new BigNumber("123.456"));
        expect(result).toBe("123.456");
    });

    test("should format zero", () => {
        const result = formatValue(0);
        expect(result).toBe("0");
    });

    test("should format negative number", () => {
        const result = formatValue(-123.456);
        expect(result).toBe("-123.456");
    });

    test("should format very large number", () => {
        const result = formatValue(1000000000);
        expect(result).toBe("1000000000");
    });

    test("should format very small number", () => {
        const result = formatValue(0.000000001);
        expect(result).toBe("1e-9");
    });
});
