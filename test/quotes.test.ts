/**
 * @file quotes.test.ts
 * @description Comprehensive unit tests for safe swap quotes, input validation, and precision.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import {
  getFissionQuote,
  getFusionQuote,
  getTransmuteToPegQuote,
  getTransmuteFromPegQuote,
} from "@/lib/functions/reactor/quotes";
import { FakeGluonClient, createFakeChainState } from "./fakeClient";
import type { SwapClient } from "@/lib/functions/reactor/types";

describe("quotes.ts", () => {
  const fakeClient = new FakeGluonClient("healthy") as unknown as SwapClient;
  const chain = createFakeChainState();

  describe("Input Validation Edge Cases", () => {
    it("returns invalid-input error for empty or whitespace-only input without throwing", () => {
      const res1 = getFissionQuote(fakeClient, chain, "");
      expect(res1.ok).toBe(false);
      if (!res1.ok && res1.kind === "invalid-input") {
        expect(res1.message).toBe("Amount cannot be empty");
      }

      const res2 = getFissionQuote(fakeClient, chain, "   ");
      expect(res2.ok).toBe(false);
      if (!res2.ok && res2.kind === "invalid-input") {
        expect(res2.message).toBe("Amount cannot be empty");
      }
    });

    it("returns invalid-input error for zero input without throwing", () => {
      const res = getFissionQuote(fakeClient, chain, "0");
      expect(res.ok).toBe(false);
      if (!res.ok && res.kind === "invalid-input") {
        expect(res.message).toBe("Amount must be greater than zero");
      }
    });

    it("returns invalid-input error for negative input without throwing", () => {
      const res = getFissionQuote(fakeClient, chain, "-5");
      expect(res.ok).toBe(false);
      if (!res.ok && res.kind === "invalid-input") {
        expect(res.message).toBe("Amount must be greater than zero");
      }
    });

    it("returns invalid-input error for malformed numeric strings without throwing", () => {
      const res1 = getFissionQuote(fakeClient, chain, "abc");
      expect(res1.ok).toBe(false);
      if (!res1.ok && res1.kind === "invalid-input") {
        expect(res1.message).toContain("Invalid");
      }

      const res2 = getFissionQuote(fakeClient, chain, "1.2.3");
      expect(res2.ok).toBe(false);
      if (!res2.ok && res2.kind === "invalid-input") {
        expect(res2.message).toContain("Invalid");
      }
    });
  });

  describe("Precision and Decimal Handling", () => {
    it("parses 9 decimals (ERG standard) correctly and calculates fission quote", () => {
      const res = getFissionQuote(fakeClient, chain, "1.5");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.quote.ergIn).toBe(1500000000n);
        expect(res.quote.neutronsOut).toBeGreaterThan(0n);
        expect(res.quote.protonsOut).toBeGreaterThan(0n);
      }
    });

    it("handles 0 decimals token without precision issues", () => {
      const res = getTransmuteToPegQuote(fakeClient, chain, "10", 0);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.quote.protonsIn).toBe(10n);
      }
    });

    it("handles 3 decimals token correctly", () => {
      const res = getTransmuteToPegQuote(fakeClient, chain, "1.234", 3);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.quote.protonsIn).toBe(1234n);
      }
    });

    it("handles huge inputs above 2^53 losslessly", () => {
      const hugeText = "100000000.000000001"; // 100,000,000.000000001 ERG
      const res = getFissionQuote(fakeClient, chain, hugeText);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.quote.ergIn).toBe(100000000000000001n);
      }
    });
  });

  describe("GluonError Passthrough", () => {
    it("returns gluon REACTOR_UNHEALTHY error when client is in unhealthy mode", () => {
      const unhealthyClient = new FakeGluonClient("above-range") as unknown as SwapClient;
      const res = getFissionQuote(unhealthyClient, chain, "1.0");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("gluon");
        if (res.kind === "gluon") {
          expect(res.error.code).toBe("REACTOR_UNHEALTHY");
        }
      }
    });

    it("returns gluon ORACLE_STALE error when client is in stale-oracle mode", () => {
      const staleClient = new FakeGluonClient("stale-oracle") as unknown as SwapClient;
      const res = getFissionQuote(staleClient, chain, "1.0");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("gluon");
        if (res.kind === "gluon") {
          expect(res.error.code).toBe("ORACLE_STALE");
        }
      }
    });

    it("returns gluon AMOUNT_TOO_LARGE error when input exceeds reactor reserve", () => {
      const res = getFusionQuote(fakeClient, chain, "10000.0"); // exceeds 1,000 ERG fake reserve
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("gluon");
        if (res.kind === "gluon") {
          expect(res.error.code).toBe("AMOUNT_TOO_LARGE");
        }
      }
    });

    it("returns gluon WOULD_LEAVE_HEALTHY_RANGE error on excessive transmutation", () => {
      const res = getTransmuteToPegQuote(fakeClient, chain, "60.0", 9); // > 50 tokens
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("gluon");
        if (res.kind === "gluon") {
          expect(res.error.code).toBe("WOULD_LEAVE_HEALTHY_RANGE");
        }
      }
    });

    it("returns gluon BUYBACK_UNAVAILABLE error when mode has no buyback box", () => {
      const noBuybackClient = new FakeGluonClient("no-buyback") as unknown as SwapClient;
      const res = getTransmuteToPegQuote(noBuybackClient, chain, "1.0", 9);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("gluon");
        if (res.kind === "gluon") {
          expect(res.error.code).toBe("BUYBACK_UNAVAILABLE");
        }
      }
    });

    it("calculates transmute from peg quote successfully", () => {
      const res = getTransmuteFromPegQuote(fakeClient, chain, "2.0", 9);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.quote.neutronsIn).toBe(2000000000n);
        expect(res.quote.protonsOut).toBeGreaterThan(0n);
      }
    });
  });
});
