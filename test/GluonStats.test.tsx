/**
 * @file GluonStats.test.tsx
 * @description Tests for GluonStats, GluonExplainer, and dashboard volume helpers
 * across Gold (peg drift 1.0 and 0.99) and Dollar deployments.
 * @module test
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "bun:test";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { GluonDeployment, ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";
import { GluonContext, type GluonContextValue } from "@/lib/providers/GluonProvider";
import { PRESENTATION } from "@/config/presentation";
import { GluonStats } from "@/lib/components/blocks/dashboard/GluonStats";
import { GluonExplainer } from "@/lib/components/blocks/dashboard/GluonExplainer";
import { sumVolumeBuckets, buildVolumeSeries } from "@/lib/functions/reactor/dashboard";
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
  }: {
    deployment?: GluonDeployment;
    presentation?: (typeof PRESENTATION)[string];
    snapshot?: ProtocolSnapshot;
    status?: "loading" | "ready" | "error";
  }
) {
  const client = new FakeGluonClient("healthy");
  const value: GluonContextValue = {
    deployment,
    presentation,
    client: client as unknown as GluonContextValue["client"],
    snapshot,
    status,
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

  it("builds chronological volume series ordered oldest to Today", () => {
    const series = buildVolumeSeries([1_000_000_000n, 2_000_000_000n], [500_000_000n, 0n]);
    expect(series).toHaveLength(2);
    expect(series[0].day).toBe("1d ago");
    expect(series[0].plusErg).toBe(2);
    expect(series[1].day).toBe("Today");
    expect(series[1].plusErg).toBe(1);
    expect(series[1].minusErg).toBe(0.5);
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
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("10.50");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("5.25");
    fireEvent.click(screen.getByRole("button", { name: "1d" }));
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("0.10");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("0.05");
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(screen.getByTestId("stat-volume-plus").textContent).toBe("2.80");
    expect(screen.getByTestId("stat-volume-minus").textContent).toBe("1.40");
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
  afterEach(() => {
    cleanup();
  });

  it("expands to show deployment token names and the v3 Healthy Range & Adjust Peg section", () => {
    renderWithGluon(<GluonExplainer />, {
      deployment: syntheticDollarDeployment,
      presentation: PRESENTATION["gluon-dollar-v3"],
    });

    const toggle = screen.getByRole("button", { name: /How does Gluon work/i });
    fireEvent.click(toggle);

    expect(screen.getByText("HEALTHY RANGE & ADJUST PEG")).toBeDefined();
    expect(screen.getByText(/Adjust Peg transaction/i)).toBeDefined();
    expect(screen.getByText(/overcollateralized reactor with q below 50%/i)).toBeDefined();
    expect(screen.getAllByText(/GUSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GUSDC/).length).toBeGreaterThanOrEqual(1);
  });
});
