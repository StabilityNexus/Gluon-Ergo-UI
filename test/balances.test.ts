/**
 * @file balances.test.ts
 * @description Unit tests for pure balance aggregation and formatting functions.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import {
  sumBalances,
  tokenBalance,
  toBalanceList,
  toWalletState,
  pairBalance,
} from "@/lib/functions/reactor/balances";
import type { Box, Amount } from "@fleet-sdk/common";
import { syntheticGoldDeployment } from "./setup";

describe("balances.ts pure functions", () => {
  const tokenA = syntheticGoldDeployment.tokens.neutron.id;
  const tokenB = syntheticGoldDeployment.tokens.proton.id;

  it("safely sums ERG amounts larger than 2^53 without precision loss", () => {
    // 2^53 is 9007199254740992n. Let's test a value above 2^53: 10_000_000_000_000_000n.
    const hugeErg1 = 10_000_000_000_000_000n;
    const hugeErg2 = 25_000_000_000_000_000n;

    const boxes: Box<Amount>[] = [
      {
        boxId: "1".repeat(64),
        value: hugeErg1.toString(),
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "a".repeat(64),
        index: 0,
      },
      {
        boxId: "2".repeat(64),
        value: hugeErg2.toString(),
        ergoTree: "0008cd",
        creationHeight: 1001,
        assets: [],
        additionalRegisters: {},
        transactionId: "b".repeat(64),
        index: 0,
      },
    ];

    const balances = sumBalances(boxes);
    expect(balances.erg).toBe(35_000_000_000_000_000n);
  });

  it("aggregates tokens spread over multiple boxes", () => {
    const boxes: Box<Amount>[] = [
      {
        boxId: "1".repeat(64),
        value: "1000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [
          { tokenId: tokenA, amount: "500000" },
          { tokenId: tokenB, amount: "200000" },
        ],
        additionalRegisters: {},
        transactionId: "a".repeat(64),
        index: 0,
      },
      {
        boxId: "2".repeat(64),
        value: "2000000",
        ergoTree: "0008cd",
        creationHeight: 1001,
        assets: [
          { tokenId: tokenA, amount: "700000" },
          { tokenId: "token-other", amount: "1000" },
        ],
        additionalRegisters: {},
        transactionId: "b".repeat(64),
        index: 0,
      },
    ];

    const balances = sumBalances(boxes);
    expect(balances.erg).toBe(3000000n);
    expect(tokenBalance(balances, tokenA)).toBe(1200000n);
    expect(tokenBalance(balances, tokenB)).toBe(200000n);
    expect(tokenBalance(balances, "token-other")).toBe(1000n);
  });

  it("returns 0n for absent tokens in tokenBalance", () => {
    const balances = sumBalances([]);
    expect(balances.erg).toBe(0n);
    expect(tokenBalance(balances, "non-existent-token")).toBe(0n);
  });

  it("converts balances to toBalanceList shape matching getBalance()", () => {
    const boxes: Box<Amount>[] = [
      {
        boxId: "1".repeat(64),
        value: "5000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [
          { tokenId: tokenA, amount: "12345" },
        ],
        additionalRegisters: {},
        transactionId: "a".repeat(64),
        index: 0,
      },
    ];

    const balances = sumBalances(boxes);
    const list = toBalanceList(balances);

    expect(list).toEqual([
      { tokenId: "ERG", balance: "5000000" },
      { tokenId: tokenA, balance: "12345" },
    ]);
  });

  it("maps balances to toWalletState strings and keys accurately", () => {
    const boxes: Box<Amount>[] = [
      {
        boxId: "1".repeat(64),
        value: "9000000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [
          { tokenId: tokenA, amount: "500000000" },
          { tokenId: tokenB, amount: "300000000" },
        ],
        additionalRegisters: {},
        transactionId: "a".repeat(64),
        index: 0,
      },
    ];

    const balances = sumBalances(boxes);
    const now = 1700000000000;
    const state = toWalletState(balances, syntheticGoldDeployment, now);

    expect(state).toEqual({
      erg: "9000000000",
      gau: "500000000",
      gauc: "300000000",
      timestamp: now,
    });
  });

  it("computes pairBalance as the minimum of neutron and proton balances", () => {
    // neutron = 500, proton = 300 -> min is 300
    const boxes1: Box<Amount>[] = [
      {
        boxId: "1".repeat(64),
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [
          { tokenId: tokenA, amount: "500" },
          { tokenId: tokenB, amount: "300" },
        ],
        additionalRegisters: {},
        transactionId: "a".repeat(64),
        index: 0,
      },
    ];
    expect(pairBalance(sumBalances(boxes1), syntheticGoldDeployment)).toBe(300n);

    // neutron = 100, proton = 400 -> min is 100
    const boxes2: Box<Amount>[] = [
      {
        boxId: "2".repeat(64),
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [
          { tokenId: tokenA, amount: "100" },
          { tokenId: tokenB, amount: "400" },
        ],
        additionalRegisters: {},
        transactionId: "b".repeat(64),
        index: 0,
      },
    ];
    expect(pairBalance(sumBalances(boxes2), syntheticGoldDeployment)).toBe(100n);
  });
});

