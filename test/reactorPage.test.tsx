/**
 * @file reactorPage.test.tsx
 * @description Integration and hydration tests for ReactorDashboard (/reactor) verifying
 * SSR hydration and ReactorHealth status/error wiring.
 * @module test
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { GluonError, type GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import { ErgoProvider } from "@/lib/providers/ErgoProvider";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { useGluon } from "@/lib/hooks/useGluon";
import ReactorDashboard from "@/pages/reactor";
import { FakeGluonClient } from "./fakeClient";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = window.localStorage;
}

function RefreshHelper() {
  const { refresh } = useGluon();
  return (
    <button
      type="button"
      data-testid="refresh-button"
      onClick={() => {
        void refresh().catch(() => {});
      }}
    >
      Refresh Gluon
    </button>
  );
}

describe("ReactorDashboard Page Tests", () => {
  const originalAbortController = globalThis.AbortController;
  const originalAbortSignal = globalThis.AbortSignal;

  beforeAll(() => {
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

  it("hydrates cleanly without errors", async () => {
    const client = new FakeGluonClient("healthy");
    const element = (
      <ErgoProvider>
        <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
          <ReactorDashboard />
        </GluonProvider>
      </ErgoProvider>
    );

    const html = renderToString(element);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const recoverableErrors: Error[] = [];
    const consoleErrors: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    };

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError(error) {
            recoverableErrors.push(error as Error);
          },
        });
      });

      expect(recoverableErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } finally {
      console.error = originalConsoleError;
      if (root) {
        await act(async () => {
          root?.unmount();
        });
      }
      container.remove();
    }
  });

  it("surfaces error message in ReactorHealth when initial fetch fails without snapshot", async () => {
    const client = new FakeGluonClient("healthy");
    client.fetchChainState = async () => {
      throw new GluonError("NODE_ERROR", "node unreachable");
    };

    render(
      <ErgoProvider>
        <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
          <ReactorDashboard />
        </GluonProvider>
      </ErgoProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const messages = screen.getAllByText("Reconnecting to the node.");
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Loading reactor data…")).toBeNull();
  });

  it("surfaces stale warning in ReactorHealth when refresh fails with retained snapshot", async () => {
    let shouldFail = false;
    const client = new FakeGluonClient("healthy");
    const originalFetch = client.fetchChainState.bind(client);
    client.fetchChainState = async () => {
      if (shouldFail) {
        throw new Error("Network timeout");
      }
      return originalFetch();
    };

    render(
      <ErgoProvider>
        <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
          <RefreshHelper />
          <ReactorDashboard />
        </GluonProvider>
      </ErgoProvider>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText("Healthy")).toBeDefined();

    shouldFail = true;
    fireEvent.click(screen.getByTestId("refresh-button"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByText("Last update failed; showing the last known data. Retrying.")).toBeDefined();
  });
});
