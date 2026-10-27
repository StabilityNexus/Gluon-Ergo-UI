/**
 * @file GluonProvider.test.tsx
 * @description Unit tests for GluonProvider polling, error resilience, and visibility pause.
 * @module test
 */
import React from "react";
import { describe, expect, it } from "bun:test";
import { render, waitFor, act } from "@testing-library/react";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { useGluon } from "@/lib/hooks/useGluon";
import { FakeGluonClient } from "./fakeClient";
import type { GluonClient } from "@stability-nexus/gluon-ergo-sdk";

function ConsumerComponent() {
  const { status, snapshot, error } = useGluon();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="healthy">{snapshot ? String(snapshot.healthy) : "none"}</span>
      <span data-testid="error">{error ? error.message : "none"}</span>
    </div>
  );
}

describe("GluonProvider", () => {
  it("initializes and fetches chain state and snapshot on mount", async () => {
    const fakeClient = new FakeGluonClient("healthy");

    const { getByTestId } = render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <ConsumerComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(getByTestId("status").textContent).toBe("ready");
    });

    expect(getByTestId("healthy").textContent).toBe("true");
    expect(fakeClient.calls.some((c) => c.method === "fetchChainState")).toBe(true);
    expect(fakeClient.calls.some((c) => c.method === "snapshot")).toBe(true);
  });

  it("retains last good state on refresh failure and sets status to error", async () => {
    const fakeClient = new FakeGluonClient("healthy");

    const { getByTestId } = render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <ConsumerComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(getByTestId("status").textContent).toBe("ready");
    });
    expect(getByTestId("healthy").textContent).toBe("true");

    // Next call fails
    fakeClient.fetchChainState = async () => {
      throw new Error("Node connection timed out");
    };

    // Trigger visibility change to fire refresh
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(getByTestId("status").textContent).toBe("error");
    });

    // Healthy state is retained from previous good snapshot
    expect(getByTestId("healthy").textContent).toBe("true");
    expect(getByTestId("error").textContent).toContain("Node connection timed out");
  });

  it("pauses polling while document.visibilityState is hidden", async () => {
    const fakeClient = new FakeGluonClient("healthy");

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={50}>
        <ConsumerComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(fakeClient.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Mock hidden tab
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    const countWhenHidden = fakeClient.calls.length;

    // Wait 120ms (more than 2 poll intervals)
    await new Promise((r) => setTimeout(r, 120));

    // No new calls occurred while hidden
    expect(fakeClient.calls.length).toBe(countWhenHidden);

    // Reset visibility to visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(fakeClient.calls.length).toBeGreaterThan(countWhenHidden);
    });
  });
});
