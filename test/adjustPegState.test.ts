/**
 * @file adjustPegState.test.ts
 * @description Comprehensive tests for getAdjustPegState covering all precedence tiers, collisions, visibility rules, and exact button labels.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { getAdjustPegState, type AdjustPegStateInput } from "@/lib/functions/reactor/adjustPegState";
import { createFakeSnapshot } from "./fakeClient";

describe("adjustPegState pure precedence tests", () => {
  const baseUnhealthySnapshot = createFakeSnapshot("below-range");
  const baseHealthySnapshot = createFakeSnapshot("healthy");

  const baseInput: AdjustPegStateInput = {
    snapshot: baseUnhealthySnapshot,
    status: "ready",
    error: undefined,
    connected: true,
    walletReady: true,
    networkBlocked: false,
    phase: "idle",
    stepsDone: 0,
    remainingSteps: 3,
  };

  it("returns visible: false when snapshot is undefined", () => {
    const res = getAdjustPegState({
      ...baseInput,
      snapshot: undefined,
    });
    expect(res).toEqual({
      visible: false,
      disabled: true,
      label: "",
      action: "none",
    });
  });

  it("returns visible: false when snapshot is healthy", () => {
    const res = getAdjustPegState({
      ...baseInput,
      snapshot: baseHealthySnapshot,
    });
    expect(res).toEqual({
      visible: false,
      disabled: true,
      label: "",
      action: "none",
    });
  });

  it("row 1: disables and prompts to connect when disconnected", () => {
    const res1 = getAdjustPegState({
      ...baseInput,
      connected: false,
      walletReady: false,
    });
    expect(res1).toEqual({
      visible: true,
      disabled: true,
      label: "Connect wallet (top bar)",
      action: "none",
    });

    const res2 = getAdjustPegState({
      ...baseInput,
      connected: true,
      walletReady: false,
    });
    expect(res2).toEqual({
      visible: true,
      disabled: true,
      label: "Connect wallet (top bar)",
      action: "none",
    });
  });

  it("row 1b: disables and shows 'Wrong network' when networkBlocked is true", () => {
    const res = getAdjustPegState({
      ...baseInput,
      networkBlocked: true,
    });
    expect(res).toEqual({
      visible: true,
      disabled: true,
      label: "Wrong network",
      action: "none",
    });
  });

  it("row 2: disables and shows 'Waiting for your wallet…' during signing phase", () => {
    const res = getAdjustPegState({
      ...baseInput,
      phase: "signing",
    });
    expect(res).toEqual({
      visible: true,
      disabled: true,
      label: "Waiting for your wallet…",
      action: "none",
    });
  });

  it("row 3: disables and shows 'Waiting for the network…' during waiting phase", () => {
    const res = getAdjustPegState({
      ...baseInput,
      phase: "waiting",
    });
    expect(res).toEqual({
      visible: true,
      disabled: true,
      label: "Waiting for the network…",
      action: "none",
    });
  });

  it("row 4: enables and shows 'Check again' with action 'recheck' during timeout phase", () => {
    const res = getAdjustPegState({
      ...baseInput,
      phase: "timeout",
    });
    expect(res).toEqual({
      visible: true,
      disabled: false,
      label: "Check again",
      action: "recheck",
    });
  });

  it("row 5: disables and shows 'Waiting for the network…' when error is present or status is error", () => {
    const resWithError = getAdjustPegState({
      ...baseInput,
      error: new Error("Network timeout"),
    });
    expect(resWithError).toEqual({
      visible: true,
      disabled: true,
      label: "Waiting for the network…",
      action: "none",
    });

    const resWithStatusError = getAdjustPegState({
      ...baseInput,
      status: "error",
    });
    expect(resWithStatusError).toEqual({
      visible: true,
      disabled: true,
      label: "Waiting for the network…",
      action: "none",
    });
  });

  it("row 6: disables and shows 'Waiting for the next oracle update…' when oracleAge >= 35", () => {
    const staleSnapshot = {
      ...baseUnhealthySnapshot,
      oracleAge: 35,
    };
    const res = getAdjustPegState({
      ...baseInput,
      snapshot: staleSnapshot,
    });
    expect(res).toEqual({
      visible: true,
      disabled: true,
      label: "Waiting for the next oracle update…",
      action: "none",
    });
  });

  it("row 7: disables and shows 'Checking…' when remainingSteps is undefined or 0", () => {
    const resUndefined = getAdjustPegState({
      ...baseInput,
      remainingSteps: undefined,
    });
    expect(resUndefined).toEqual({
      visible: true,
      disabled: true,
      label: "Checking…",
      action: "none",
    });

    const resZero = getAdjustPegState({
      ...baseInput,
      remainingSteps: 0,
    });
    expect(resZero).toEqual({
      visible: true,
      disabled: true,
      label: "Checking…",
      action: "none",
    });
  });

  it("row 8: enables button and shows exact step label when ready", () => {
    const res1 = getAdjustPegState({
      ...baseInput,
      stepsDone: 0,
      remainingSteps: 3,
    });
    expect(res1).toEqual({
      visible: true,
      disabled: false,
      label: "Adjust peg (step 1 of 3)",
      action: "adjust",
    });

    const res2 = getAdjustPegState({
      ...baseInput,
      stepsDone: 1,
      remainingSteps: 2,
    });
    expect(res2).toEqual({
      visible: true,
      disabled: false,
      label: "Adjust peg (step 2 of 3)",
      action: "adjust",
    });

    const res3 = getAdjustPegState({
      ...baseInput,
      stepsDone: 2,
      remainingSteps: 1,
    });
    expect(res3).toEqual({
      visible: true,
      disabled: false,
      label: "Adjust peg (step 3 of 3)",
      action: "adjust",
    });
  });

  describe("precedence collisions", () => {
    it("not connected beats networkBlocked", () => {
      const res = getAdjustPegState({
        ...baseInput,
        connected: false,
        networkBlocked: true,
      });
      expect(res.label).toBe("Connect wallet (top bar)");
      expect(res.disabled).toBe(true);
      expect(res.action).toBe("none");
    });

    it("networkBlocked beats signing phase", () => {
      const res = getAdjustPegState({
        ...baseInput,
        networkBlocked: true,
        phase: "signing",
      });
      expect(res.label).toBe("Wrong network");
      expect(res.disabled).toBe(true);
      expect(res.action).toBe("none");
    });

    it("timeout phase beats error/status error", () => {
      const res = getAdjustPegState({
        ...baseInput,
        phase: "timeout",
        error: new Error("Node transient error"),
        status: "error",
      });
      expect(res.label).toBe("Check again");
      expect(res.disabled).toBe(false);
      expect(res.action).toBe("recheck");
    });

    it("waiting phase beats stale oracle", () => {
      const staleSnapshot = {
        ...baseUnhealthySnapshot,
        oracleAge: 40,
      };
      const res = getAdjustPegState({
        ...baseInput,
        phase: "waiting",
        snapshot: staleSnapshot,
      });
      expect(res.label).toBe("Waiting for the network…");
      expect(res.disabled).toBe(true);
      expect(res.action).toBe("none");
    });

    it("signing phase beats stale oracle and remainingSteps 0", () => {
      const staleSnapshot = {
        ...baseUnhealthySnapshot,
        oracleAge: 50,
      };
      const res = getAdjustPegState({
        ...baseInput,
        phase: "signing",
        snapshot: staleSnapshot,
        remainingSteps: 0,
      });
      expect(res.label).toBe("Waiting for your wallet…");
      expect(res.disabled).toBe(true);
      expect(res.action).toBe("none");
    });
  });
});
