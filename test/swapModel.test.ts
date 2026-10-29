/**
 * @file swapModel.test.ts
 * @description Unit tests for swapModel pure reducer, drivingField, sanitizeAmountInput, and computeMax.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import {
  createInitialSwapState,
  swapReducer,
  drivingField,
  sanitizeAmountInput,
  computeMax,
  formatMaxAmount,
} from "@/lib/functions/reactor/swapModel";
import { ACTION_TYPES } from "@/lib/constants/token";
import { syntheticGoldDeployment } from "./setup";
import { FakeGluonClient, createFakeChainState } from "./fakeClient";
import { MIN_ERG_RESERVE } from "@/lib/functions/reactor/constants";
import type { SwapClient } from "@/lib/functions/reactor/types";

describe("swapModel pure functions", () => {
  const deployment = syntheticGoldDeployment;
  const neutronName = deployment.tokens.neutron.name; // GAU
  const protonName = deployment.tokens.proton.name;   // GAUC
  const pairSymbol = `${neutronName}-${protonName}`; // GAU-GAUC

  describe("createInitialSwapState and swapReducer", () => {
    it("initializes to ERG -> Pair token with empty amount", () => {
      const initial = createInitialSwapState(deployment);
      expect(initial.fromSymbol).toBe("ERG");
      expect(initial.toSymbol).toBe(pairSymbol);
      expect(initial.amountText).toBe("");
    });

    it("resets amountText on valid token reversal", () => {
      let state = createInitialSwapState(deployment);
      state = swapReducer(state, { type: "setAmount", amountText: "10.5" });
      expect(state.amountText).toBe("10.5");

      // ERG -> GAU-GAUC reversed to GAU-GAUC -> ERG (Fusion)
      state = swapReducer(state, { type: "reverse", deployment });
      expect(state.fromSymbol).toBe(pairSymbol);
      expect(state.toSymbol).toBe("ERG");
      expect(state.amountText).toBe("");
    });

    it("safely ignores an invalid reversal", () => {
      // Manually craft an invalid state: ERG -> ERG
      const invalidState = { fromSymbol: "ERG", toSymbol: "ERG", amountText: "5" };
      const nextState = swapReducer(invalidState, { type: "reverse", deployment });
      expect(nextState).toBe(invalidState); // Unchanged
    });

    it("resets amount on selecting a new from-token and picks default valid to-token", () => {
      let state = createInitialSwapState(deployment);
      state = swapReducer(state, { type: "setAmount", amountText: "100" });

      // Change from ERG to GAUC (proton) -> valid to-token is GAU (neutron)
      state = swapReducer(state, { type: "selectFrom", symbol: protonName, deployment });
      expect(state.fromSymbol).toBe(protonName);
      expect(state.toSymbol).toBe(neutronName);
      expect(state.amountText).toBe("");
    });

    it("ignores selecting an invalid to-token", () => {
      let state = createInitialSwapState(deployment); // fromSymbol is ERG
      state = swapReducer(state, { type: "setAmount", amountText: "15" });

      // ERG cannot be converted directly to GAUC (only to GAU-GAUC pair)
      const nextState = swapReducer(state, { type: "selectTo", symbol: protonName, deployment });
      expect(nextState.toSymbol).toBe(pairSymbol);
      expect(nextState.amountText).toBe("15"); // Unchanged
    });

    it("resets state to initial when reset action is dispatched", () => {
      let state = { fromSymbol: protonName, toSymbol: neutronName, amountText: "50" };
      state = swapReducer(state, { type: "reset", deployment });
      expect(state.fromSymbol).toBe("ERG");
      expect(state.toSymbol).toBe(pairSymbol);
      expect(state.amountText).toBe("");
    });
  });

  describe("drivingField", () => {
    it("identifies driving input field correctly for all 4 swap actions", () => {
      expect(drivingField(ACTION_TYPES.FISSION)).toBe("from");
      expect(drivingField(ACTION_TYPES.FUSION)).toBe("to");
      expect(drivingField(ACTION_TYPES.TRANSMUTE_TO_PEG)).toBe("from");
      expect(drivingField(ACTION_TYPES.TRANSMUTE_FROM_PEG)).toBe("from");
      expect(drivingField(null)).toBe("from");
    });
  });

  describe("sanitizeAmountInput", () => {
    it("handles digits, commas, dots, and empty strings", () => {
      expect(sanitizeAmountInput("", 9)).toBe("");
      expect(sanitizeAmountInput("123", 9)).toBe("123");
      expect(sanitizeAmountInput("1,5", 9)).toBe("1.5");
      expect(sanitizeAmountInput(".5", 9)).toBe(".5");
      expect(sanitizeAmountInput("0.123", 9)).toBe("0.123");
    });

    it("rejects second dot or invalid characters (returns null)", () => {
      expect(sanitizeAmountInput("1.2.3", 9)).toBeNull();
      expect(sanitizeAmountInput("1,2,3", 9)).toBeNull();
      expect(sanitizeAmountInput("12a", 9)).toBeNull();
      expect(sanitizeAmountInput("-5", 9)).toBeNull();
      expect(sanitizeAmountInput(" ", 9)).toBeNull();
    });

    it("enforces token decimal constraints (decimals = 9)", () => {
      expect(sanitizeAmountInput("1.123456789", 9)).toBe("1.123456789");
      expect(sanitizeAmountInput("1.1234567890", 9)).toBeNull(); // 10 decimals rejected
    });

    it("enforces token decimal constraints (decimals = 0)", () => {
      expect(sanitizeAmountInput("123", 0)).toBe("123");
      expect(sanitizeAmountInput("123.", 0)).toBeNull();
      expect(sanitizeAmountInput("123.5", 0)).toBeNull();
      expect(sanitizeAmountInput("123,5", 0)).toBeNull();
    });
  });

  describe("computeMax and formatMaxAmount", () => {
    it("returns 0n for fission when wallet ERG is below MIN_ERG_RESERVE", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = {
        erg: MIN_ERG_RESERVE - 1000n, // Below reserve buffer
        tokens: new Map<string, bigint>(),
      };

      const max = computeMax({
        action: ACTION_TYPES.FISSION,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      expect(max).toBe(0n);
      expect(formatMaxAmount(max, 9)).toBe("0");
    });

    it("computes fission MAX with available ERG above reserve", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = {
        erg: 10_000_000_000n, // 10 ERG
        tokens: new Map<string, bigint>(),
      };

      const max = computeMax({
        action: ACTION_TYPES.FISSION,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      // Max should be positive and less than walletErg - MIN_ERG_RESERVE
      expect(max).toBeGreaterThan(0n);
      expect(max).toBeLessThanOrEqual(balances.erg - MIN_ERG_RESERVE);
      expect(formatMaxAmount(max, 9)).not.toBe("0");
    });

    it("computes fusion MAX based on wallet tokens and ERG", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = {
        erg: 5_000_000_000n,
        tokens: new Map<string, bigint>([
          [deployment.tokens.neutron.id, 1_000_000_000n],
          [deployment.tokens.proton.id, 1_000_000_000n],
        ]),
      };

      const max = computeMax({
        action: ACTION_TYPES.FUSION,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      expect(max).toBeGreaterThan(0n);
    });

    it("computes transmutation to-peg MAX", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = {
        erg: 1_000_000_000n,
        tokens: new Map<string, bigint>([
          [deployment.tokens.proton.id, 500_000_000n],
        ]),
      };

      const max = computeMax({
        action: ACTION_TYPES.TRANSMUTE_TO_PEG,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      expect(max).toBeGreaterThan(0n);
    });

    it("computes transmutation from-peg MAX", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = {
        erg: 1_000_000_000n,
        tokens: new Map<string, bigint>([
          [deployment.tokens.neutron.id, 400_000_000n],
        ]),
      };

      const max = computeMax({
        action: ACTION_TYPES.TRANSMUTE_FROM_PEG,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      expect(max).toBeGreaterThan(0n);
    });

    it("returns 0n when action is null", () => {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();
      const balances = { erg: 10_000_000_000n, tokens: new Map<string, bigint>() };

      const max = computeMax({
        action: null,
        client: client as unknown as SwapClient,
        chain,
        balances,
        deployment,
      });

      expect(max).toBe(0n);
    });
  });
});
