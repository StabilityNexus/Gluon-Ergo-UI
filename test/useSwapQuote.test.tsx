/**
 * @file useSwapQuote.test.tsx
 * @description Unit tests for useSwapQuote hook covering status transitions, race guards, debounce, immediate recomputation, error mapping, and SSR probe.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { useSwapQuote } from "@/lib/hooks/useSwapQuote";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import { FakeGluonClient, createFakeChainState, createFakeQuote } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import type { SwapClient } from "@/lib/functions/reactor/types";

describe("useSwapQuote hook", () => {
  const deployment = syntheticGoldDeployment;

  it("handles status transitions: idle -> pending -> ready", async () => {
    const client = new FakeGluonClient("healthy");
    const chain = createFakeChainState();

    const { result, rerender } = renderHook(
      ({ amt }) =>
        useSwapQuote({
          client: client as unknown as SwapClient,
          chain,
          action: ACTION_TYPES.FISSION,
          amountText: amt,
          deployment,
          debounceMs: 20,
        }),
      { initialProps: { amt: "" } }
    );

    // Initial empty amount is idle
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeUndefined();

    // Entering amount immediately transitions to pending
    rerender({ amt: "2.5" });
    expect(result.current.status).toBe("pending");

    // Wait for debounce timer to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.result?.ok).toBe(true);
  });

  it("coalesces multiple rapid keystrokes within debounce interval", async () => {
    const client = new FakeGluonClient("healthy");
    let quoteCallCount = 0;
    const origQuoteFission = client.quoteFission.bind(client);
    client.quoteFission = (chain, erg) => {
      quoteCallCount++;
      return origQuoteFission(chain, erg);
    };

    const chain = createFakeChainState();
    let currentAmount = "1";

    const { result, rerender } = renderHook(
      ({ amount }) =>
        useSwapQuote({
          client: client as unknown as SwapClient,
          chain,
          action: ACTION_TYPES.FISSION,
          amountText: amount,
          deployment,
          debounceMs: 25,
        }),
      { initialProps: { amount: currentAmount } }
    );

    expect(result.current.status).toBe("pending");

    // Fast keystroke 2
    currentAmount = "1.5";
    rerender({ amount: currentAmount });

    // Fast keystroke 3
    currentAmount = "1.55";
    rerender({ amount: currentAmount });

    // Wait for the debounce timer to fire once
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.result?.ok).toBe(true);
    // Should have coalesced the keystrokes: only 1 quoteFission call actually made
    expect(quoteCallCount).toBe(1);
  });

  it("guards against out-of-order race conditions: newer text arriving before debounce cancels earlier computation", async () => {
    const client = new FakeGluonClient("healthy");
    const chain = createFakeChainState();

    const calledAmounts: string[] = [];
    client.quoteFission = (_c, erg) => {
      calledAmounts.push(erg.toString());
      const quote = createFakeQuote();
      quote.ergIn = erg;
      return quote;
    };

    let amount = "1.0";
    const { result, rerender } = renderHook(
      ({ amt }) =>
        useSwapQuote({
          client: client as unknown as SwapClient,
          chain,
          action: ACTION_TYPES.FISSION,
          amountText: amt,
          deployment,
          debounceMs: 35,
        }),
      { initialProps: { amt: amount } }
    );

    // Call 1 is pending
    expect(result.current.status).toBe("pending");

    // Wait a brief period (shorter than debounce delay 35ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Fire Call 2 before Call 1's timer fires
    amount = "2.0";
    rerender({ amt: amount });

    // Wait for Call 2's timer to fire and settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.result?.ok).toBe(true);
    // Call 1 was cancelled before its quote function could ever be called
    expect(calledAmounts).toEqual(["2000000000"]);
    if (result.current.result?.ok) {
      expect(result.current.result.quote.ergIn).toBe(2000000000n);
    }
  });

  it("recomputes immediately without debounce delay when chain state changes", async () => {
    const client = new FakeGluonClient("healthy");
    let quoteCallCount = 0;
    client.quoteFission = () => {
      quoteCallCount++;
      return createFakeQuote();
    };

    let chain = createFakeChainState({ height: 100 });

    const { result, rerender } = renderHook(
      ({ c }) =>
        useSwapQuote({
          client: client as unknown as SwapClient,
          chain: c,
          action: ACTION_TYPES.FISSION,
          amountText: "1.0",
          deployment,
          debounceMs: 50,
        }),
      { initialProps: { c: chain } }
    );

    // Initial quote settles after debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(quoteCallCount).toBe(1);
    expect(result.current.status).toBe("ready");

    // Chain poll arrives (height updates) with same amountText
    chain = createFakeChainState({ height: 101 });
    rerender({ c: chain });

    // Should recompute immediately (delay = 0, no 50ms delay needed)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(quoteCallCount).toBe(2);
    expect(result.current.status).toBe("ready");
  });

  it("recomputes immediately without debounce delay when action changes", async () => {
    const client = new FakeGluonClient("healthy");
    let fissionCallCount = 0;
    let transmuteCallCount = 0;

    client.quoteFission = () => {
      fissionCallCount++;
      return createFakeQuote();
    };

    client.quoteBetaDecayPlus = () => {
      transmuteCallCount++;
      return createFakeQuote();
    };

    const chain = createFakeChainState({ height: 100 });

    const { result, rerender } = renderHook(
      ({ actType }: { actType: ActionType }) =>
        useSwapQuote({
          client: client as unknown as SwapClient,
          chain,
          action: actType,
          amountText: "1.0",
          deployment,
          debounceMs: 50,
        }),
      { initialProps: { actType: ACTION_TYPES.FISSION as ActionType } }
    );

    // Initial quote settles after debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(fissionCallCount).toBe(1);
    expect(result.current.status).toBe("ready");

    // Action changes from FISSION to TRANSMUTE_TO_PEG
    rerender({ actType: ACTION_TYPES.TRANSMUTE_TO_PEG });

    // Should recompute immediately (delay = 0, no 50ms delay needed)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(transmuteCallCount).toBe(1);
    expect(result.current.status).toBe("ready");
  });

  it("maps invalid numeric input to kind 'invalid-input'", async () => {
    const client = new FakeGluonClient("healthy");
    const chain = createFakeChainState();

    const { result } = renderHook(() =>
      useSwapQuote({
        client: client as unknown as SwapClient,
        chain,
        action: ACTION_TYPES.FISSION,
        amountText: "invalid-text",
        deployment,
        debounceMs: 10,
      })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.result?.ok).toBe(false);
    if (!result.current.result?.ok) {
      expect(result.current.result?.kind).toBe("invalid-input");
    }
  });

  it("passes GluonError through with kind 'gluon'", async () => {
    const client = new FakeGluonClient("healthy");
    client.quoteFission = () => {
      throw new GluonError("REACTOR_UNHEALTHY", "Reserve ratio is too low for fission");
    };

    const chain = createFakeChainState();

    const { result } = renderHook(() =>
      useSwapQuote({
        client: client as unknown as SwapClient,
        chain,
        action: ACTION_TYPES.FISSION,
        amountText: "10.0",
        deployment,
        debounceMs: 10,
      })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.result?.ok).toBe(false);
    if (!result.current.result?.ok) {
      expect(result.current.result?.kind).toBe("gluon");
      if (result.current.result?.kind === "gluon") {
        expect(result.current.result.error.code).toBe("REACTOR_UNHEALTHY");
      }
    }
  });

  it("SSR probe: schedules ZERO timers and produces no side effects during renderToString", () => {
    let timerCreated = false;
    const originalSetTimeout = globalThis.setTimeout;
    // Probe setTimeout invocations
    globalThis.setTimeout = function (
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) {
      timerCreated = true;
      return (originalSetTimeout as unknown as (...a: unknown[]) => unknown)(
        handler,
        timeout,
        ...args
      );
    } as unknown as typeof setTimeout;

    try {
      const client = new FakeGluonClient("healthy");
      const chain = createFakeChainState();

      function ServerSwapComponent() {
        const { status, result } = useSwapQuote({
          client: client as unknown as SwapClient,
          chain,
          action: ACTION_TYPES.FISSION,
          amountText: "5.0",
          deployment,
          debounceMs: 300,
        });

        return (
          <div data-testid="swap-quote-ssr">
            <span data-testid="status">{status}</span>
            <span data-testid="result">{result ? "has-result" : "no-result"}</span>
          </div>
        );
      }

      const html = renderToString(<ServerSwapComponent />);

      expect(html).toContain("no-result");
      expect(timerCreated).toBe(false);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
