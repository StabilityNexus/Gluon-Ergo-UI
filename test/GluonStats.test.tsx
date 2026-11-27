/**
 * @file GluonStats.test.tsx
 * @description Tests for GluonStats, GluonExplainer, and dashboard volume helpers
 * across Gold (peg drift 1.0 and 0.99) and Dollar deployments.
 * @module test
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "bun:test";
import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { GluonError, type GluonDeployment, type ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";
import { GluonContext, type GluonContextValue } from "@/lib/providers/GluonProvider";
import { PRESENTATION } from "@/config/presentation";
import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import { GluonExplainer } from "@/lib/components/blocks/dashboard/GluonExplainer";
import {
  ProtonAPYBadge,
  computeWindowYield,
  getHistorySnapshot,
  pruneHistory,
  shouldRecordObservation,
} from "@/lib/components/blocks/dashboard/ProtonAPYBadge";
import { sumVolumeBuckets, buildVolumeSeries, formatVolumeTick } from "@/lib/functions/reactor/dashboard";
import { createFakeSnapshot, FakeGluonClient } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";

const syntheticDollarDeployment: GluonDeployment = {
  ...syntheticGoldDeployment,
  name: "gluon-dollar-v3",
  peg: "1 USD",
  tokens: {
    nft: { id: "d".repeat(64), name: "GUSD-NFT", decimals: 0, emission: 1n },
    neutron: { id: "e".repeat(64), name: "GUSD", decimals: 9, emission: 1000000000000n },
    proton: { id: "f".repeat(64), name: "GUSDC", decimals: 9, emission: 1000000000000n },
  },
};

function renderWithGluon(
  ui: React.ReactElement,
  {
    deployment = syntheticGoldDeployment,
    presentation = PRESENTATION["gluon-gold-v3"],
    snapshot,
    status = "ready",
    error,
  }: {
    deployment?: GluonDeployment;
    presentation?: (typeof PRESENTATION)[string];
    snapshot?: ProtocolSnapshot;
    status?: "loading" | "ready" | "error";
    error?: Error;
  }
) {
  const client = new FakeGluonClient("healthy");
  const value: GluonContextValue = {
    deployment,
    presentation,
    client: client as unknown as GluonContextValue["client"],
    snapshot,
    status,
    error,
    refresh: async () => client.fetchChainState(),
  };

  return render(<GluonContext.Provider value={value}>{ui}</GluonContext.Provider>);
}

describe("dashboard.ts pure helpers", () => {
  it("sums first 1, 7, and 14 volume buckets", () => {
    const buckets = [10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n, 90n, 100n];
    expect(sumVolumeBuckets(buckets, 1)).toBe(10n);
    expect(sumVolumeBuckets(buckets, 7)).toBe(280n);
    expect(sumVolumeBuckets(buckets, 14)).toBe(550n);
  });

  it("builds chronological 14-bucket volume series ordered oldest to Today with zeros for empty days", () => {
    const series = buildVolumeSeries([1_000_000_000n, 2_000_000_000n], [500_000_000n, 0n]);
    expect(series).toHaveLength(14);
    expect(series[0].day).toBe("13d ago");
    expect(series[0].plusErg).toBe(0);
    expect(series[0].minusErg).toBe(0);
    expect(series[12].day).toBe("1d ago");
    expect(series[12].plusErg).toBe(2);
    expect(series[13].day).toBe("Today");
    expect(series[13].plusErg).toBe(1);
    expect(series[13].minusErg).toBe(0.5);
  });

  it("formats VolumeChart Y-axis ticks with adaptive precision for small and large values", () => {
    expect(formatVolumeTick(0)).toBe("0");
    expect(formatVolumeTick(0.0025)).toBe("0.0025");
    expect(formatVolumeTick(0.025)).toBe("0.025");
    expect(formatVolumeTick(0.1)).toBe("0.10");
    expect(formatVolumeTick(12.34)).toBe("12.3");
    expect(formatVolumeTick(1500)).toBe("1.5k");
  });
});

describe("GluonStats Component Tests", () => {
  const originalAbortController = globalThis.AbortController;
  const originalAbortSignal = globalThis.AbortSignal;

  beforeAll(() => {
    // motion-dom hover gestures pass an AbortSignal to jsdom's addEventListener,
    // which rejects Bun's native AbortSignal unless JSDOM's AbortController/AbortSignal are used.
    if (window.AbortController) {
      globalThis.AbortController = window.AbortController as unknown as typeof AbortController;
    }
    if (window.AbortSignal) {
      globalThis.AbortSignal = window.AbortSignal as unknown as typeof AbortSignal;
    }
  });

  afterAll(() => {
    globalThis.AbortController = originalAbortController;
    globalThis.AbortSignal = originalAbortSignal;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Gold stats at peg drift 1.0 with no USD or ERG price polling card", () => {
    const plusBuckets = Array.from({ length: 14 }, (_, i) => BigInt(i + 1) * 100_000_000n);
    const minusBuckets = Array.from({ length: 14 }, (_, i) => BigInt(i + 1) * 50_000_000n);

    const snapshot: ProtocolSnapshot = {
      ...createFakeSnapshot("healthy"),
      reserve: 1_000_000_000_000n,
      reserveRatio: 142.86,
      pegFactor: 1_000_000n,
      initialPegFactor: 1_000_000n,
      pegDrift: 1.0,
      volumes: {
        plus: plusBuckets,
        minus: minusBuckets,
      },
    };

    const { container } = renderWithGluon(<GluonStats />, {
      deployment: syntheticGoldDeployment,
      presentation: PRESENTATION["gluon-gold-v3"],
      snapshot,
    });

    expect(screen.getByText("1g")).toBeDefined();
    expect(screen.getByText("Gold (from Oracle)")).toBeDefined();
    expect(screen.getByText("GAU")).toBeDefined();
    expect(screen.getByText("GAUC")).toBeDefined();
    expect(screen.getByTestId("stat-tvl").textContent).toBe("1K ERG");
    expect(screen.getByTestId("stat-fusion-ratio").textContent).toBe("70.0%");
    expect(screen.getByTestId("stat-reserve-ratio").textContent).toBe("143%");
    expect(screen.getByTestId("stat-target-price").textContent).toBe("1.5 ERG");
    expect(screen.getByTestId("stat-peg-drift").textContent).toBe("100.0%");
    expect(screen.getByTestId("stat-crash-cushion").textContent).toBe("35.0%");
    expect(screen.getByTestId("stat-until-adjustment").textContent).toBe("15.0% fall before trading pauses");
    expect(screen.getByTestId("stat-proton-leverage").textContent).toBe("2.10x");
    expect(screen.getByTestId("stat-supply-neutron").textContent).toBe("500.00");
    expect(screen.getByTestId("stat-supply-proton").textContent).toBe("500.00");

    const text = container.textContent ?? "";
    expect(text).not.toContain("ERG Price:");
    expect(text).not.toContain("USD");

    // Volume window toggle: 14d -> 1d -> 7d (distinct sums for plus and minus)
    const btn14 = screen.getByRole("button", { name: "14d" });
    const btn7 = screen.getByRole("button", { name: "7d" });
    const btn1 = screen.getByRole("button", { name: "1d" });
    expect(btn14.getAttribute("aria-pressed")).toBe("true");
    expect(btn7.getAttribute("aria-pressed")).toBe("false");
    expect(btn1.getAttribute("aria-pressed")).toBe("false");

    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("10.50");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("5.25");
    fireEvent.click(btn1);
    expect(btn1.getAttribute("aria-pressed")).toBe("true");
    expect(btn14.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("0.10");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("0.05");
    fireEvent.click(btn7);
    expect(btn7.getAttribute("aria-pressed")).toBe("true");
    expect(btn1.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("2.80");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("1.40");
  });

  it("renders loading, initial error, cached-error recovery, and zero volume states", () => {
    // 1. Loading
    renderWithGluon(<GluonStats />, { status: "loading", snapshot: undefined });
    expect(screen.getAllByText("Loading…").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Loading volume data…")).toBeDefined();
    cleanup();

    // 2. Initial error without snapshot
    renderWithGluon(<GluonStats />, {
      status: "error",
      snapshot: undefined,
      error: new GluonError("NODE_ERROR", "node unreachable"),
    });
    expect(screen.getAllByText("Reconnecting to the node.").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Loading…")).toBeNull();
    cleanup();

    // 3. Cached-error recovery: error with retained snapshot, then recovery to ready
    const snap = { ...createFakeSnapshot("healthy"), volumes: { plus: [], minus: [] } };
    const client = new FakeGluonClient("healthy");
    const { rerender } = render(
      <GluonContext.Provider
        value={{
          deployment: syntheticGoldDeployment,
          presentation: PRESENTATION["gluon-gold-v3"],
          client: client as unknown as GluonContextValue["client"],
          snapshot: snap,
          status: "error",
          error: new Error("timeout"),
          refresh: async () => client.fetchChainState(),
        }}
      >
        <GluonStats />
      </GluonContext.Provider>
    );

    expect(screen.getByText("Showing last known data")).toBeDefined();
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("0.00");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("0.00");
    expect(screen.getByText("No volume data available")).toBeDefined();

    rerender(
      <GluonContext.Provider
        value={{
          deployment: syntheticGoldDeployment,
          presentation: PRESENTATION["gluon-gold-v3"],
          client: client as unknown as GluonContextValue["client"],
          snapshot: snap,
          status: "ready",
          refresh: async () => client.fetchChainState(),
        }}
      >
        <GluonStats />
      </GluonContext.Provider>
    );
    expect(screen.queryByText("Showing last known data")).toBeNull();
  });

  it("renders Gold stats at peg drift 0.99 and shows '—' when protonLeverage is undefined", () => {
    const snapshot: ProtocolSnapshot = {
      ...createFakeSnapshot("healthy"),
      pegFactor: 990_000n,
      initialPegFactor: 1_000_000n,
      pegDrift: 0.99,
      targetPrice: 1_485_000_000n,
      protonLeverage: undefined,
    };

    renderWithGluon(<GluonStats />, {
      deployment: syntheticGoldDeployment,
      presentation: PRESENTATION["gluon-gold-v3"],
      snapshot,
    });

    expect(screen.getByTestId("stat-peg-drift").textContent).toBe("99.0%");
    expect(screen.getByTestId("stat-target-price").textContent).toBe("1.485 ERG");
    expect(screen.getByText("Target: 1.485 ERG (peg 99.0% of initial)")).toBeDefined();
    expect(screen.getByTestId("stat-proton-leverage").textContent).toBe("—");
  });

  it("renders Dollar stats with GUSD/GUSDC tickers and 1 USD label", () => {
    const snapshot: ProtocolSnapshot = {
      ...createFakeSnapshot("healthy"),
      deployment: "gluon-dollar-v3",
      reserveRatio: 142.86,
      pegFactor: 1_000_000_000n,
      initialPegFactor: 1_000_000_000n,
      pegDrift: 1.0,
    };

    renderWithGluon(<GluonStats />, {
      deployment: syntheticDollarDeployment,
      presentation: PRESENTATION["gluon-dollar-v3"],
      snapshot,
    });

    expect(screen.getByText("1 USD")).toBeDefined();
    expect(screen.getByText("USD (from Oracle)")).toBeDefined();
    expect(screen.getByText("GUSD")).toBeDefined();
    expect(screen.getByText("GUSDC")).toBeDefined();
    expect(screen.getByText("GUSD Supply")).toBeDefined();
    expect(screen.getByText("GUSDC Supply")).toBeDefined();
  });
});

describe("GluonExplainer Component Tests", () => {
  const prevSkipAnimations = MotionGlobalConfig.skipAnimations;

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  afterAll(() => {
    MotionGlobalConfig.skipAnimations = prevSkipAnimations;
  });

  afterEach(() => {
    cleanup();
  });

  it("expands to show deployment token names and the v3 Healthy Range & Adjust Peg section", async () => {
    renderWithGluon(<GluonExplainer />, {
      deployment: syntheticDollarDeployment,
      presentation: PRESENTATION["gluon-dollar-v3"],
    });

    const toggle = screen.getByRole("button", { name: /How does Gluon work/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    expect(screen.getByText("HEALTHY RANGE & ADJUST PEG")).toBeDefined();
    expect(screen.getByText(/Adjust Peg transaction/i)).toBeDefined();
    expect(screen.getByText(/overcollateralized reactor with q below 50%/i)).toBeDefined();
    expect(screen.getAllByText(/GUSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GUSDC/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => {
      expect(screen.queryByText("HEALTHY RANGE & ADJUST PEG")).toBeNull();
    });
  });
});

describe("ProtonAPYBadge Cache Isolation", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("clears entries on parse failure when switching to a deployment with malformed JSON", () => {
    const keyA = "gluon_proton_history:gluon-gold-v3";
    const keyB = "gluon_proton_history:gluon-dollar-v3";
    const entriesA = [
      { ts: Date.now() - 40 * 86_400_000, value: 0.25 },
      { ts: Date.now(), value: 0.5 },
    ];
    window.localStorage.setItem(keyA, JSON.stringify(entriesA));
    window.localStorage.setItem(keyB, "{malformed-json");

    expect(getHistorySnapshot(keyA)).toHaveLength(2);
    expect(getHistorySnapshot(keyB)).toEqual([]);

    const { rerender } = renderWithGluon(<ProtonAPYBadge />, {
      deployment: syntheticGoldDeployment,
      presentation: PRESENTATION["gluon-gold-v3"],
      snapshot: createFakeSnapshot("healthy"),
    });

    rerender(
      <GluonContext.Provider
        value={{
          deployment: syntheticDollarDeployment,
          presentation: PRESENTATION["gluon-dollar-v3"],
          client: new FakeGluonClient("healthy") as unknown as GluonContextValue["client"],
          snapshot: undefined,
          status: "loading",
          refresh: async () => new FakeGluonClient("healthy").fetchChainState(),
        }}
      >
        <ProtonAPYBadge />
      </GluonContext.Provider>
    );

    // Switching to B with malformed JSON must show no entries and never write A's history under B's key
    expect(screen.getByText(/Accumulating data/i)).toBeDefined();
    expect(window.localStorage.getItem(keyB)).toBe("{malformed-json");
    expect(getHistorySnapshot(keyA)).toHaveLength(2);
  });
});

describe("ProtonAPYBadge APY Math (computeWindowYield & retention)", () => {
  const DAY_MS = 86_400_000;
  const HOUR_MS = 3_600_000;

  it("does not report an old increase on day 61 when price 1->2 happened on day 1 (30D baseline is day 1)", () => {
    const history = [
      { ts: 0, value: 1 },
      { ts: 1 * DAY_MS, value: 2 },
    ];
    const res = computeWindowYield(history, 2, 61 * DAY_MS, 30);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.elapsedDays).toBe(60);
      expect(res.apy).toBe(0);
      expect(res.apr).toBe(0);
    }
  });

  it("returns insufficient for a 1-day interval on a 30D window", () => {
    const history = [{ ts: 0, value: 1 }];
    const res = computeWindowYield(history, 2, 1 * DAY_MS, 30);
    expect(res).toEqual({ status: "insufficient" });
  });

  it("computes expected APY and APR for exactly 30 days elapsed", () => {
    const history = [{ ts: 0, value: 1 }];
    const res = computeWindowYield(history, 1.1, 30 * DAY_MS, 30);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.elapsedDays).toBe(30);
      const expectedApy = (Math.pow(1.1, 365 / 30) - 1) * 100;
      const expectedApr = 0.1 * (365 / 30) * 100;
      expect(res.apy).toBeCloseTo(expectedApy, 6);
      expect(res.apr).toBeCloseTo(expectedApr, 6);
    }
  });

  it("guards past <= 0 and non-finite inputs", () => {
    expect(computeWindowYield([{ ts: 0, value: 0 }], 2, 30 * DAY_MS, 30)).toEqual({ status: "insufficient" });
    expect(computeWindowYield([{ ts: 0, value: 1 }], null, 30 * DAY_MS, 30)).toEqual({ status: "insufficient" });
    expect(computeWindowYield([{ ts: 0, value: 1 }], Number.NaN, 30 * DAY_MS, 30)).toEqual({ status: "insufficient" });
  });

  it("records unchanged-price observations after >= 1 hour and retains 90D anchor across 120d pruning", () => {
    const h = [{ ts: 0, value: 2 }];
    expect(shouldRecordObservation(h, 2, 30 * 60_000)).toBe(false);
    expect(shouldRecordObservation(h, 2, HOUR_MS)).toBe(true);

    const nowMs = 150 * DAY_MS;
    const oldAnchor = { ts: 10 * DAY_MS, value: 1.0 }; // 140d old, newest <= 90d cutoff (60d)
    const veryOld = { ts: 1 * DAY_MS, value: 0.9 };
    const recent = { ts: 100 * DAY_MS, value: 1.5 };
    const pruned = pruneHistory([veryOld, oldAnchor, recent], nowMs);
    expect(pruned).toEqual([oldAnchor, recent]);
  });
});
