/**
 * @file describeQuote.test.ts
 * @description Unit tests for describeQuote helper covering all 4 actions, token symbols, custom decimals, and exhaustiveness.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { describeQuote } from "@/lib/functions/reactor/describeQuote";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { ActionQuote, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { syntheticGoldDeployment } from "./setup";
import { createFakeQuote } from "./fakeClient";

describe("describeQuote", () => {
  // Modified deployment with non-9 decimals to prove decimals come dynamically from deployment
  const customDeployment: GluonDeployment = {
    ...syntheticGoldDeployment,
    tokens: {
      ...syntheticGoldDeployment.tokens,
      neutron: {
        ...syntheticGoldDeployment.tokens.neutron,
        name: "TEST_NEU",
        decimals: 4,
      },
      proton: {
        ...syntheticGoldDeployment.tokens.proton,
        name: "TEST_PRO",
        decimals: 2,
      },
    },
  };

  it("describes FISSION: pays ERG (9 dec), receives neutrons (4 dec) and protons (2 dec)", () => {
    const quote: ActionQuote = {
      ...createFakeQuote(),
      ergIn: 2500000000n, // 2.5 ERG (9 decimals)
      neutronsOut: 1234500n, // 123.45 TEST_NEU (4 decimals)
      protonsOut: 9870n, // 98.7 TEST_PRO (2 decimals)
    };

    const res = describeQuote(ACTION_TYPES.FISSION, quote, customDeployment);

    expect(res.pay).toEqual([{ symbol: "ERG", amount: "2.5" }]);
    expect(res.receive).toEqual([
      { symbol: "TEST_NEU", amount: "123.45" },
      { symbol: "TEST_PRO", amount: "98.7" },
    ]);
  });

  it("describes FUSION: pays neutrons (4 dec) and protons (2 dec), receives ERG (9 dec)", () => {
    const quote: ActionQuote = {
      ...createFakeQuote(),
      neutronsIn: 50000n, // 5 TEST_NEU (4 decimals)
      protonsIn: 4000n, // 40 TEST_PRO (2 decimals)
      ergOut: 1000000000n, // 1 ERG (9 decimals)
    };

    const res = describeQuote(ACTION_TYPES.FUSION, quote, customDeployment);

    expect(res.pay).toEqual([
      { symbol: "TEST_NEU", amount: "5" },
      { symbol: "TEST_PRO", amount: "40" },
    ]);
    expect(res.receive).toEqual([{ symbol: "ERG", amount: "1" }]);
  });

  it("describes TRANSMUTE_TO_PEG: pays protons (2 dec), receives neutrons (4 dec)", () => {
    const quote: ActionQuote = {
      ...createFakeQuote(),
      protonsIn: 750n, // 7.5 TEST_PRO (2 decimals)
      neutronsOut: 80000n, // 8 TEST_NEU (4 decimals)
    };

    const res = describeQuote(ACTION_TYPES.TRANSMUTE_TO_PEG, quote, customDeployment);

    expect(res.pay).toEqual([{ symbol: "TEST_PRO", amount: "7.5" }]);
    expect(res.receive).toEqual([{ symbol: "TEST_NEU", amount: "8" }]);
  });

  it("describes TRANSMUTE_FROM_PEG: pays neutrons (4 dec), receives protons (2 dec)", () => {
    const quote: ActionQuote = {
      ...createFakeQuote(),
      neutronsIn: 30000n, // 3 TEST_NEU (4 decimals)
      protonsOut: 250n, // 2.5 TEST_PRO (2 decimals)
    };

    const res = describeQuote(ACTION_TYPES.TRANSMUTE_FROM_PEG, quote, customDeployment);

    expect(res.pay).toEqual([{ symbol: "TEST_NEU", amount: "3" }]);
    expect(res.receive).toEqual([{ symbol: "TEST_PRO", amount: "2.5" }]);
  });

  it("throws for unsupported action types without compile-time as never escape", () => {
    const quote = createFakeQuote();
    expect(() =>
      describeQuote("unsupported-action" as unknown as ActionType, quote, customDeployment)
    ).toThrow("Unsupported action type for describeQuote: unsupported-action");
  });
});

