/**
 * @file GluonProvider.test.tsx
 * @description Unit tests for GluonProvider polling, error resilience, and visibility pause.
 * @module test
 */
import React from "react";
import { describe, expect, it, afterEach } from "bun:test";
import { render, waitFor, act, cleanup } from "@testing-library/react";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { useGluon } from "@/lib/hooks/useGluon";
import { FakeGluonClient, createFakeChainState } from "./fakeClient";
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
  afterEach(cleanup);

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

  it("refresh() resolves with the fresh ChainState", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    let refreshFn: (() => Promise<unknown>) | undefined;

    function RefreshCaptureComponent() {
      const { refresh } = useGluon();
      React.useEffect(() => {
        refreshFn = refresh;
      }, [refresh]);
      return null;
    }

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <RefreshCaptureComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(refreshFn).toBeDefined();
    });

    let freshChain: unknown;
    await act(async () => {
      freshChain = await refreshFn!();
    });
    expect(freshChain).toBeDefined();
    expect((freshChain as { height: number }).height).toBe(1250000);
  });

  it("two concurrent refresh() calls cause exactly one fetchChainState call and resolve to the same ChainState", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    let refreshFn: (() => Promise<unknown>) | undefined;

    function Capture() {
      const { refresh } = useGluon();
      React.useEffect(() => {
        refreshFn = refresh;
      }, [refresh]);
      return null;
    }

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <Capture />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(refreshFn).toBeDefined();
    });

    // Reset calls
    fakeClient.calls = [];

    let res1: unknown;
    let res2: unknown;
    await act(async () => {
      [res1, res2] = await Promise.all([refreshFn!(), refreshFn!()]);
    });

    // Exactly one fetchChainState call
    const fetchCalls = fakeClient.calls.filter((c) => c.method === "fetchChainState");
    expect(fetchCalls.length).toBe(1);
    expect(res1).toBe(res2);

    // Later calls start a new fetch
    await act(async () => {
      await refreshFn!();
    });
    const subsequentCalls = fakeClient.calls.filter((c) => c.method === "fetchChainState");
    expect(subsequentCalls.length).toBe(2);
  });

  it("concurrent refresh() failure rejects both callers", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    fakeClient.fetchChainState = async () => {
      throw new Error("Network failure during fetch");
    };

    let refreshFn: (() => Promise<unknown>) | undefined;

    function Capture() {
      const { refresh } = useGluon();
      React.useEffect(() => {
        refreshFn = refresh;
      }, [refresh]);
      return null;
    }

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <Capture />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(refreshFn).toBeDefined();
    });

    let err1: unknown;
    let err2: unknown;
    await act(async () => {
      try {
        await Promise.all([
          refreshFn!().catch((e) => { err1 = e; throw e; }),
          refreshFn!().catch((e) => { err2 = e; throw e; }),
        ]);
      } catch {
        // expected rejection
      }
    });

    expect(err1).toBeDefined();
    expect(err2).toBeDefined();
    expect((err1 as Error).message).toBe("Network failure during fetch");
    expect((err2 as Error).message).toBe("Network failure during fetch");
  });

  it("clears refreshPromiseRef when fetchChainState throws synchronously so second refresh starts a new fetch", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    let callCount = 0;
    let shouldThrow = true;

    fakeClient.fetchChainState = () => {
      callCount++;
      if (shouldThrow) {
        throw new Error("Synchronous fetchChainState crash");
      }
      return Promise.resolve(createFakeChainState());
    };

    let refreshFn: (() => Promise<unknown>) | undefined;

    function Capture() {
      const { refresh } = useGluon();
      React.useEffect(() => {
        refreshFn = refresh;
      }, [refresh]);
      return null;
    }

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <Capture />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(refreshFn).toBeDefined();
    });

    // Reset callCount from initial mount
    callCount = 0;

    // First refresh rejects
    let firstError: unknown;
    await act(async () => {
      try {
        await refreshFn!();
      } catch (err) {
        firstError = err;
      }
    });

    expect(firstError).toBeDefined();
    expect((firstError as Error).message).toBe("Synchronous fetchChainState crash");
    expect(callCount).toBe(1);

    // Fix the fake client
    shouldThrow = false;

    // Second refresh starts a new fetch (call count 2) and resolves
    let secondResult: unknown;
    await act(async () => {
      secondResult = await refreshFn!();
    });

    expect(secondResult).toBeDefined();
    expect(callCount).toBe(2);
  });

  it("exposes deployment (the synthetic one) and presentation in context", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    let ctxDeployment: unknown;
    let ctxPresentation: unknown;

    function MetadataCaptureComponent() {
      const { deployment, presentation } = useGluon();
      React.useEffect(() => {
        ctxDeployment = deployment;
        ctxPresentation = presentation;
      }, [deployment, presentation]);
      return null;
    }

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={10000}>
        <MetadataCaptureComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(ctxDeployment).toBeDefined();
      expect(ctxPresentation).toBeDefined();
    });

    expect((ctxDeployment as { name: string }).name).toBe("gluon-gold-v3");
    expect((ctxPresentation as { protocolName: string }).protocolName).toBe("GLUON GOLD");
  });

  it("does not poll when pollIntervalMs is 0", async () => {
    const fakeClient = new FakeGluonClient("healthy");

    render(
      <GluonProvider client={fakeClient as unknown as GluonClient} pollIntervalMs={0}>
        <ConsumerComponent />
      </GluonProvider>
    );

    await waitFor(() => {
      expect(fakeClient.calls.some((c) => c.method === "fetchChainState")).toBe(true);
    });

    const initialFetchCount = fakeClient.calls.filter((c) => c.method === "fetchChainState").length;
    expect(initialFetchCount).toBe(1);

    // Wait 100ms
    await new Promise((r) => setTimeout(r, 100));

    // No timer polling should have triggered
    const laterFetchCount = fakeClient.calls.filter((c) => c.method === "fetchChainState").length;
    expect(laterFetchCount).toBe(1);
  });
});
