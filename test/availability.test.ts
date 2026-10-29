/**
 * @file availability.test.ts
 * @description Comprehensive unit tests for swap availability state table and priority collisions.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { getSwapAvailability } from "@/lib/functions/reactor/availability";
import { createFakeSnapshot } from "./fakeClient";

describe("getSwapAvailability", () => {
  it("row 1: Healthy protocol state enables all actions without banner", () => {
    const snapshot = createFakeSnapshot("healthy");
    const result = getSwapAvailability({ snapshot, status: "ready" });

    expect(result.fission).toBe(true);
    expect(result.fusion).toBe(true);
    expect(result.transmuteToPeg).toBe(true);
    expect(result.transmuteFromPeg).toBe(true);
    expect(result.banner).toBeUndefined();
  });

  it("loading state disables all actions with Loading banner", () => {
    const result = getSwapAvailability({ status: "loading" });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("LOADING");
    expect(result.banner?.text).toBe("Loading reactor data…");
  });

  it("undefined snapshot disables all actions with Loading banner", () => {
    const result = getSwapAvailability({ snapshot: undefined, status: "ready" });

    expect(result.fission).toBe(false);
    expect(result.banner?.code).toBe("LOADING");
    expect(result.banner?.text).toBe("Loading reactor data…");
  });

  it("error with last good snapshot disables all actions", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new GluonError("NODE_ERROR", "network down");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("NODE_ERROR");
    expect(result.banner?.text).toBe("Reconnecting to the node.");
  });

  it("row 2: Unhealthy q above 98% (direction down) disables all actions and shows downward adjustment banner", () => {
    const snapshot = createFakeSnapshot("above-range");
    const result = getSwapAvailability({ snapshot, status: "ready" });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("REACTOR_UNHEALTHY_ABOVE");
    expect(result.banner?.text).toBe(
      "The neutrons in circulation are worth more than 98 % of this reactor's reserve. Trading resumes after the peg factor is lowered, 1 % per step (2 steps at the current price). Anyone can do this."
    );
  });

  it("row 3: Unhealthy q below 50% (direction up) disables all actions and shows upward adjustment banner", () => {
    const snapshot = createFakeSnapshot("below-range");
    const result = getSwapAvailability({ snapshot, status: "ready" });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("REACTOR_UNHEALTHY_BELOW");
    expect(result.banner?.text).toBe(
      "The neutrons in circulation are worth less than 50 % of this reactor's reserve. Trading resumes after the peg factor is raised, 1 % per step (3 steps at the current price). Anyone can do this."
    );
  });

  it("row 4: Oracle stale (oracleAge >= 35) disables all actions", () => {
    const snapshot = {
      ...createFakeSnapshot("healthy"),
      oracleAge: 35,
    };
    const result = getSwapAvailability({ snapshot, status: "ready" });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("ORACLE_STALE");
    expect(result.banner?.text).toBe("Waiting for the next oracle update.");
  });

  it("row 4b: ORACLE_STALE error code disables all actions", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new GluonError("ORACLE_STALE", "stale oracle error");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.banner?.code).toBe("ORACLE_STALE");
    expect(result.banner?.text).toBe("Waiting for the next oracle update.");
  });

  it("row 5: Buyback unavailable disables only transmutations while fission/fusion stay enabled", () => {
    const snapshot = {
      ...createFakeSnapshot("healthy"),
      betaDecaysAvailable: false,
    };
    const result = getSwapAvailability({ snapshot, status: "ready" });

    expect(result.fission).toBe(true);
    expect(result.fusion).toBe(true);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("BUYBACK_UNAVAILABLE");
    expect(result.banner?.text).toBe("The oracle's buyback box is unavailable.");
  });

  it("row 6: BOX_AMBIGUOUS error disables all actions", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new GluonError("BOX_AMBIGUOUS", "mempool race");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("BOX_AMBIGUOUS");
    expect(result.banner?.text).toBe("The reactor or the oracle is being updated; retrying.");
  });

  it("row 7: NODE_ERROR disables all actions", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new GluonError("NODE_ERROR", "network unreachable");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.fusion).toBe(false);
    expect(result.transmuteToPeg).toBe(false);
    expect(result.transmuteFromPeg).toBe(false);
    expect(result.banner?.code).toBe("NODE_ERROR");
    expect(result.banner?.text).toBe("Reconnecting to the node.");
  });

  it("row 7b: Native network TypeError (Failed to fetch) / AbortError disables all actions with NODE_ERROR banner", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error1 = new TypeError("Failed to fetch");
    const result1 = getSwapAvailability({ snapshot, status: "error", error: error1 });
    expect(result1.banner?.code).toBe("NODE_ERROR");
    expect(result1.banner?.text).toBe("Reconnecting to the node.");

    const error2 = new Error("Request aborted");
    error2.name = "AbortError";
    const result2 = getSwapAvailability({ snapshot, status: "error", error: error2 });
    expect(result2.banner?.code).toBe("NODE_ERROR");
    expect(result2.banner?.text).toBe("Reconnecting to the node.");
  });

  it("BOX_NOT_FOUND error uses getGluonErrorMessage mapping", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new GluonError("BOX_NOT_FOUND", "box not found");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.banner?.code).toBe("BOX_NOT_FOUND");
    expect(result.banner?.text).toBe("Could not find the reactor or oracle on the network. Check the node.");
  });

  it("generic unexpected Error shows retrying banner", () => {
    const snapshot = createFakeSnapshot("healthy");
    const error = new Error("Unexpected database disk error");
    const result = getSwapAvailability({ snapshot, status: "error", error });

    expect(result.fission).toBe(false);
    expect(result.banner?.code).toBe("REFRESH_ERROR");
    expect(result.banner?.text).toBe("Could not load the reactor state. Retrying.");
  });

  describe("Priority Collisions", () => {
    it("priority 1: NODE_ERROR takes precedence over BOX_AMBIGUOUS, ORACLE_STALE, and unhealthy", () => {
      const snapshot = {
        ...createFakeSnapshot("above-range"),
        oracleAge: 40,
      };
      const error = new GluonError("NODE_ERROR", "node down");
      const result = getSwapAvailability({ snapshot, status: "error", error });

      expect(result.banner?.code).toBe("NODE_ERROR");
      expect(result.banner?.text).toBe("Reconnecting to the node.");
    });

    it("priority 2: BOX_AMBIGUOUS takes precedence over ORACLE_STALE and unhealthy", () => {
      const snapshot = {
        ...createFakeSnapshot("below-range"),
        oracleAge: 50,
      };
      const error = new GluonError("BOX_AMBIGUOUS", "box ambiguous");
      const result = getSwapAvailability({ snapshot, status: "error", error });

      expect(result.banner?.code).toBe("BOX_AMBIGUOUS");
      expect(result.banner?.text).toBe("The reactor or the oracle is being updated; retrying.");
    });

    it("priority 3: ORACLE_STALE takes precedence over unhealthy q", () => {
      const snapshot = {
        ...createFakeSnapshot("above-range"),
        oracleAge: 36,
      };
      const result = getSwapAvailability({ snapshot, status: "ready" });

      expect(result.banner?.code).toBe("ORACLE_STALE");
      expect(result.banner?.text).toBe("Waiting for the next oracle update.");
    });

    it("priority 4: Unhealthy q takes precedence over !betaDecaysAvailable", () => {
      const snapshot = {
        ...createFakeSnapshot("above-range"),
        betaDecaysAvailable: false,
        oracleAge: 10,
      };
      const result = getSwapAvailability({ snapshot, status: "ready" });

      expect(result.banner?.code).toBe("REACTOR_UNHEALTHY_ABOVE");
      expect(result.fission).toBe(false);
      expect(result.fusion).toBe(false);
    });
  });
});
