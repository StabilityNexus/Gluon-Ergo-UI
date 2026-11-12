/**
 * @file limits.test.ts
 * @description Unit tests for pure BigInt swap limits, conservative change-box rule, and iteration caps.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import {
  calculateFissionMax,
  calculateFusionMax,
  calculateTransmuteToPegMax,
  calculateTransmuteFromPegMax,
  hasValidChange,
  isFissionAmountAllowed,
  SAFE_MIN_BOX_VALUE,
} from "@/lib/functions/reactor/limits";
import { FakeGluonClient, createFakeChainState } from "./fakeClient";
import type { SwapClient } from "@/lib/functions/reactor/types";

describe("limits.ts", () => {
  const fakeClient = new FakeGluonClient("healthy") as unknown as SwapClient;
  const chain = createFakeChainState();

  describe("hasValidChange", () => {
    const testBalances = [
      { name: "1e9 nanoERG (1 ERG)", balance: 1000000000n },
      { name: "1e13 nanoERG (10,000 ERG)", balance: 10000000000000n },
      { name: "1e16 nanoERG (10,000,000 ERG)", balance: 10000000000000000n },
      { name: "above 2^53 nanoERG (> 90,000,000 ERG)", balance: 100000000000000000n },
    ];

    for (const { name, balance } of testBalances) {
      it(`evaluates leftover 0, 1, SAFE_MIN-1, SAFE_MIN, SAFE_MIN+1 at ${name}`, () => {
        // Leftover 0 (exact spend) -> REJECTED by conservative rule
        const neededForZero = balance;
        expect(hasValidChange(balance, neededForZero)).toBe(false);

        // Leftover 1 nanoERG -> REJECTED
        const neededForOne = balance - 1n;
        expect(hasValidChange(balance, neededForOne)).toBe(false);

        // Leftover SAFE_MIN - 1 nanoERG -> REJECTED
        const neededForSafeMinMinusOne = balance - (SAFE_MIN_BOX_VALUE - 1n);
        expect(hasValidChange(balance, neededForSafeMinMinusOne)).toBe(false);

        // Leftover SAFE_MIN nanoERG -> ACCEPTED
        const neededForSafeMin = balance - SAFE_MIN_BOX_VALUE;
        expect(hasValidChange(balance, neededForSafeMin)).toBe(true);

        // Leftover SAFE_MIN + 1 nanoERG -> ACCEPTED
        const neededForSafeMinPlusOne = balance - (SAFE_MIN_BOX_VALUE + 1n);
        expect(hasValidChange(balance, neededForSafeMinPlusOne)).toBe(true);
      });
    }

    it("returns true when neededErg is 0n (no ERG constraint)", () => {
      expect(hasValidChange(0n, 0n)).toBe(true);
      expect(hasValidChange(1000000000n, 0n)).toBe(true);
    });

    it("returns false when neededErg exceeds walletErg", () => {
      expect(hasValidChange(1000000000n, 1000000001n)).toBe(false);
    });
  });

  describe("calculateFissionMax", () => {
    it("returns 0n when wallet ERG is zero", () => {
      const max = calculateFissionMax(fakeClient, chain, 0n);
      expect(max).toBe(0n);
    });

    it("returns 0n when wallet ERG is below safe minimum box value (1000000n)", () => {
      const max = calculateFissionMax(fakeClient, chain, 500000n);
      expect(max).toBe(0n);
    });

    it("evaluates leftover edge cases: 0, 1, SAFE_MIN - 1, SAFE_MIN, and SAFE_MIN + 1", () => {
      const testErg = 1000000000n; // 1 ERG
      const quote = fakeClient.quoteFission(chain, testErg);
      const neededErg = testErg + SAFE_MIN_BOX_VALUE + quote.fees.total;

      // Exact zero leftover -> REJECTED under conservative rule
      expect(isFissionAmountAllowed(fakeClient, chain, testErg, neededErg)).toBe(false);

      // Leftover 1 nanoERG -> REJECTED
      expect(isFissionAmountAllowed(fakeClient, chain, testErg, neededErg + 1n)).toBe(false);

      // Leftover SAFE_MIN - 1 nanoERG -> REJECTED
      expect(isFissionAmountAllowed(fakeClient, chain, testErg, neededErg + SAFE_MIN_BOX_VALUE - 1n)).toBe(false);

      // Leftover SAFE_MIN nanoERG -> ACCEPTED
      expect(isFissionAmountAllowed(fakeClient, chain, testErg, neededErg + SAFE_MIN_BOX_VALUE)).toBe(true);

      // Leftover SAFE_MIN + 1 nanoERG -> ACCEPTED
      expect(isFissionAmountAllowed(fakeClient, chain, testErg, neededErg + SAFE_MIN_BOX_VALUE + 1n)).toBe(true);
    });

    const testTiers = [
      { name: "1e9 nanoERG (1 ERG)", balance: 1000000000n },
      { name: "1e13 nanoERG (10,000 ERG)", balance: 10000000000000n },
      { name: "1e16 nanoERG (10,000,000 ERG)", balance: 10000000000000000n },
      { name: "above 2^53 nanoERG (> 90,000,000 ERG)", balance: 100000000000000000n },
    ];

    for (const { name, balance } of testTiers) {
      it(`MAX is accepted by helper and MAX+1 is not accepted at ${name}`, () => {
        const max = calculateFissionMax(fakeClient, chain, balance);
        expect(max).toBeGreaterThan(0n);

        // MAX is accepted by isFissionAmountAllowed and hasValidChange
        expect(isFissionAmountAllowed(fakeClient, chain, max, balance)).toBe(true);
        const quoteMax = fakeClient.quoteFission(chain, max);
        const neededMax = max + SAFE_MIN_BOX_VALUE + quoteMax.fees.total;
        expect(hasValidChange(balance, neededMax)).toBe(true);

        // MAX + 1n is rejected by isFissionAmountAllowed and hasValidChange
        expect(isFissionAmountAllowed(fakeClient, chain, max + 1n, balance)).toBe(false);
        const quoteMaxPlus1 = fakeClient.quoteFission(chain, max + 1n);
        const neededMaxPlus1 = (max + 1n) + SAFE_MIN_BOX_VALUE + quoteMaxPlus1.fees.total;
        expect(hasValidChange(balance, neededMaxPlus1)).toBe(false);
      });
    }
  });

  describe("calculateFusionMax", () => {
    it("returns 0n when token balances are zero", () => {
      expect(calculateFusionMax(fakeClient, chain, 0n, 1000000000n)).toBe(0n);
      expect(calculateFusionMax(fakeClient, chain, 1000000000n, 0n)).toBe(0n);
      expect(calculateFusionMax(fakeClient, chain, 0n, 0n)).toBe(0n);
    });

    it("derives MAX ERG verified against both token balances", () => {
      const walletNeutrons = 5000000000n; // 5 GAU
      const walletProtons = 10000000000n; // 10 GAUC

      const max = calculateFusionMax(fakeClient, chain, walletNeutrons, walletProtons);
      expect(max).toBeGreaterThan(0n);

      const quote = fakeClient.quoteFusion(chain, max);
      expect(quote.neutronsIn).toBeLessThanOrEqual(walletNeutrons);
      expect(quote.protonsIn).toBeLessThanOrEqual(walletProtons);
    });

    it("returns 0n when wallet ERG cannot cover fees.total for small fusion amount", () => {
      // With small token amounts (where output ERG < totalNeeded), wallet must supply neededErg.
      const smallNeutrons = 500000n; // 0.0005 GAU (gives < 1,000,000 nanoERG)
      const smallProtons = 1000000n;
      const insufficientErg = 100n; // way below needed fees

      const max = calculateFusionMax(fakeClient, chain, smallNeutrons, smallProtons, insufficientErg);
      expect(max).toBe(0n);
    });

    it("terminates within bounded iterations and handles values above 2^53", () => {
      const hugeTokens = 500000000000000000n; // > 2^53
      const max = calculateFusionMax(fakeClient, chain, hugeTokens, hugeTokens);

      expect(max).toBeGreaterThan(0n);
      expect(typeof max).toBe("bigint");
    });
  });

  describe("calculateTransmuteMax", () => {
    it("returns 0n when balance is zero", () => {
      expect(calculateTransmuteToPegMax(fakeClient, chain, 0n)).toBe(0n);
      expect(calculateTransmuteFromPegMax(fakeClient, chain, 0n)).toBe(0n);
    });

    it("returns balance when balance is less than maxBetaDecay", () => {
      const smallBalance = 1000000000n;
      expect(calculateTransmuteToPegMax(fakeClient, chain, smallBalance)).toBe(smallBalance);
      expect(calculateTransmuteFromPegMax(fakeClient, chain, smallBalance)).toBe(smallBalance);
    });

    it("caps at maxBetaDecay when balance exceeds protocol limit", () => {
      const hugeBalance = 1000000000000n;
      const maxPlus = fakeClient.maxBetaDecayPlus(chain);
      const maxMinus = fakeClient.maxBetaDecayMinus(chain);

      expect(calculateTransmuteToPegMax(fakeClient, chain, hugeBalance)).toBe(maxPlus);
      expect(calculateTransmuteFromPegMax(fakeClient, chain, hugeBalance)).toBe(maxMinus);
    });

    it("returns 0n when reactor is unhealthy (maxBetaDecay returns 0n)", () => {
      const unhealthyClient = new FakeGluonClient("above-range") as unknown as SwapClient;
      const balance = 5000000000n;

      expect(calculateTransmuteToPegMax(unhealthyClient, chain, balance)).toBe(0n);
      expect(calculateTransmuteFromPegMax(unhealthyClient, chain, balance)).toBe(0n);
    });
  });
});
