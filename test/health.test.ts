/**
 * @file health.test.ts
 * @description Unit tests for pure bigint reactor health formatting and band calculation helpers.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import {
  bandPosition,
  describePegTarget,
  formatDriftPercent,
  formatDriftRatio,
  formatErgPrice,
  formatQPercent,
  isInBand,
} from "@/lib/functions/reactor/health";
import { createFakeSnapshot } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";

describe("health.ts pure bigint helpers", () => {
  it("formatQPercent formats concrete q values with half-up rounding in bigint", () => {
    expect(formatQPercent(0n)).toBe("0.0");
    expect(formatQPercent(499_999_999n)).toBe("50.0");
    expect(formatQPercent(500_000_000n)).toBe("50.0");
    expect(formatQPercent(600_000_000n)).toBe("60.0");
    expect(formatQPercent(980_000_000n)).toBe("98.0");
    expect(formatQPercent(980_000_001n)).toBe("98.0");
    expect(formatQPercent(1_500_000_000n)).toBe("150.0");

    // Half-up rounding boundaries at 0.05% (500_000n)
    expect(formatQPercent(499_499_999n)).toBe("49.9");
    expect(formatQPercent(499_500_000n)).toBe("50.0");
    expect(formatQPercent(600_499_999n)).toBe("60.0");
    expect(formatQPercent(600_500_000n)).toBe("60.1");
  });

  it("isInBand enforces exact [500_000_000n, 980_000_000n] bounds", () => {
    expect(isInBand(0n)).toBe(false);
    expect(isInBand(499_999_999n)).toBe(false);
    expect(isInBand(500_000_000n)).toBe(true);
    expect(isInBand(600_000_000n)).toBe(true);
    expect(isInBand(980_000_000n)).toBe(true);
    expect(isInBand(980_000_001n)).toBe(false);
    expect(isInBand(1_500_000_000n)).toBe(false);
  });

  it("bandPosition computes clamped bigint percentages [0n..100n] and markers [50n, 98n]", () => {
    expect(bandPosition(0n)).toEqual({ percent: 0n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(-50_000_000n)).toEqual({ percent: 0n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(499_999_999n)).toEqual({ percent: 50n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(500_000_000n)).toEqual({ percent: 50n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(600_000_000n)).toEqual({ percent: 60n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(980_000_000n)).toEqual({ percent: 98n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(980_000_001n)).toEqual({ percent: 98n, minPercent: 50n, maxPercent: 98n });
    expect(bandPosition(1_500_000_000n)).toEqual({ percent: 100n, minPercent: 50n, maxPercent: 98n });
  });

  it("formatDriftPercent and formatDriftRatio compute bigint ratios and guard initialPegFactor = 0n", () => {
    expect(formatDriftPercent(990_000_000n, 1_000_000_000n)).toBe("99.0");
    expect(formatDriftRatio(990_000_000n, 1_000_000_000n)).toBe("0.990");

    // Half-up rounding check
    expect(formatDriftPercent(990_500_000n, 1_000_000_000n)).toBe("99.1");
    expect(formatDriftRatio(990_500_000n, 1_000_000_000n)).toBe("0.991");

    // Zero / non-positive initialPegFactor guard
    expect(formatDriftPercent(990_000_000n, 0n)).toBe("—");
    expect(formatDriftRatio(990_000_000n, 0n)).toBe("—");
  });

  it("formatErgPrice formats nanoERG amounts in ERG", () => {
    expect(formatErgPrice(0n)).toBe("0 ERG");
    expect(formatErgPrice(500_000_000n)).toBe("0.5 ERG");
    expect(formatErgPrice(1_500_000_000n)).toBe("1.5 ERG");
    expect(formatErgPrice(1_234_567_890n)).toBe("1.23456789 ERG");
  });

  it("describePegTarget builds drifted target wording without claiming pegged to 1 USD", () => {
    const base = createFakeSnapshot("healthy");
    const drifted = {
      ...base,
      pegFactor: 990_000n,
      initialPegFactor: 1_000_000n,
    };

    const result = describePegTarget(drifted, syntheticGoldDeployment);
    expect(result.text).toBe("1 GAU targets 0.990 × (1g gold)");
    expect(result.text).not.toContain("USD");
    expect(result.text).not.toContain("1 USD");
  });
});

