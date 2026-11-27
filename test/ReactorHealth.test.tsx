/**
 * @file ReactorHealth.test.tsx
 * @description Component and hydration tests for props-only ReactorHealth display.
 * @module test
 */

import { describe, it, expect, afterEach } from "bun:test";
import React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { ReactorHealth } from "@/lib/components/blockchain/reactor/ReactorHealth";
import { createFakeSnapshot } from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";

describe("ReactorHealth Component Tests", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a neutral placeholder with the same wrapper when snapshot is undefined", () => {
    const { container: placeholderContainer } = render(
      <ReactorHealth deployment={syntheticGoldDeployment} />
    );
    expect(screen.getByText("Loading reactor data…")).toBeDefined();
    expect(screen.queryByText("Reactor health")).toBeNull();

    const { container: loadedContainer } = render(
      <ReactorHealth
        snapshot={createFakeSnapshot("healthy")}
        deployment={syntheticGoldDeployment}
      />
    );

    const placeholderRoot = placeholderContainer.firstElementChild;
    const loadedRoot = loadedContainer.firstElementChild;
    expect(placeholderRoot?.tagName).toBe(loadedRoot?.tagName);
    expect(placeholderRoot?.className).toBe(loadedRoot?.className);
  });

  it("renders expected metrics, ERG prices, and accessible bar for a healthy snapshot with no USD text", () => {
    const snapshot = createFakeSnapshot("healthy");
    const { container } = render(
      <ReactorHealth snapshot={snapshot} deployment={syntheticGoldDeployment} />
    );

    expect(screen.getByText("Reactor health")).toBeDefined();
    expect(screen.getByText("Healthy")).toBeDefined();
    expect(screen.getByText("70.0 %")).toBeDefined();
    expect(screen.getByText("peg factor 100.0 % of initial")).toBeDefined();
    expect(screen.getByText("oracle price age: 5 blocks")).toBeDefined();
    expect(screen.getByText("Prices and the peg")).toBeDefined();
    expect(screen.getByText("1 GAU targets 1.000 × (1g gold)")).toBeDefined();
    expect(screen.getAllByText("1.5 ERG").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("0.5 ERG")).toBeDefined();

    const bar = screen.getByRole("img");
    const ariaLabel = bar.getAttribute("aria-label") ?? "";
    expect(ariaLabel).toContain("70.0%");
    expect(ariaLabel).toContain("50%");
    expect(ariaLabel).toContain("98%");

    const text = container.textContent ?? "";
    expect(text).not.toContain("USD");
    expect(text).not.toContain("1 USD");
  });

  it("renders 'Outside the healthy range' and drifted peg wording for unhealthy snapshots", () => {
    const below = {
      ...createFakeSnapshot("below-range"),
      pegFactor: 990_000n,
      initialPegFactor: 1_000_000n,
    };
    const { container: belowContainer } = render(
      <ReactorHealth snapshot={below} deployment={syntheticGoldDeployment} />
    );

    expect(screen.getByText("Outside the healthy range")).toBeDefined();
    expect(screen.getByText("45.0 %")).toBeDefined();
    expect(screen.getByText("peg factor 99.0 % of initial")).toBeDefined();
    expect(screen.getByText("oracle price age: 8 blocks")).toBeDefined();
    expect(screen.getByText("1 GAU targets 0.990 × (1g gold)")).toBeDefined();
    expect(belowContainer.textContent ?? "").not.toContain("USD");

    cleanup();

    const above = createFakeSnapshot("above-range");
    render(<ReactorHealth snapshot={above} deployment={syntheticGoldDeployment} />);
    expect(screen.getByText("Outside the healthy range")).toBeDefined();
    expect(screen.getByText("99.0 %")).toBeDefined();
    expect(screen.getByText("oracle price age: 12 blocks")).toBeDefined();
  });

  it("renders error message instead of loading text when status is error without snapshot", () => {
    // 1. Generic error without explicit error object
    const { rerender } = render(
      <ReactorHealth deployment={syntheticGoldDeployment} status="error" />
    );
    expect(screen.getByText("Could not load the reactor state. Retrying.")).toBeDefined();
    expect(screen.queryByText("Loading reactor data…")).toBeNull();

    // 2. NODE_ERROR
    rerender(
      <ReactorHealth
        deployment={syntheticGoldDeployment}
        status="error"
        error={new GluonError("NODE_ERROR", "network down")}
      />
    );
    expect(screen.getByText("Reconnecting to the node.")).toBeDefined();
    expect(screen.queryByText("Loading reactor data…")).toBeNull();

    // 3. BOX_AMBIGUOUS
    rerender(
      <ReactorHealth
        deployment={syntheticGoldDeployment}
        status="error"
        error={new GluonError("BOX_AMBIGUOUS", "mempool race")}
      />
    );
    expect(screen.getByText("The reactor or the oracle is being updated; retrying.")).toBeDefined();

    // 4. ORACLE_STALE
    rerender(
      <ReactorHealth
        deployment={syntheticGoldDeployment}
        status="error"
        error={new GluonError("ORACLE_STALE", "stale price")}
      />
    );
    expect(screen.getByText("Waiting for the next oracle update.")).toBeDefined();
  });

  it("renders metrics with stale indicator and muted badge when snapshot is present and status is error", () => {
    const snapshot = createFakeSnapshot("healthy");
    render(
      <ReactorHealth
        snapshot={snapshot}
        deployment={syntheticGoldDeployment}
        status="error"
        error={new GluonError("NODE_ERROR", "connection refused")}
      />
    );

    // Metrics are retained
    expect(screen.getByText("Reactor health")).toBeDefined();
    expect(screen.getByText("Healthy")).toBeDefined();
    expect(screen.getByText("70.0 %")).toBeDefined();
    expect(screen.getByText("Prices and the peg")).toBeDefined();

    // Stale status line is visible with role="status"
    const statusLine = screen.getByRole("status");
    expect(statusLine.textContent).toContain(
      "Last update failed; showing the last known data. Retrying."
    );

    // Status badge has muted treatment and data-stale attribute
    const badge = screen.getByText("Healthy");
    expect(badge.className).toContain("bg-muted");
    expect(badge.className).toContain("text-muted-foreground");
    expect(badge.className).not.toContain("bg-emerald-500");
    expect(badge.getAttribute("data-stale")).toBe("true");
  });

  it("renders normal metrics with no stale warning and styled badge when status is ready or loading", () => {
    const snapshot = createFakeSnapshot("healthy");
    const { rerender } = render(
      <ReactorHealth
        snapshot={snapshot}
        deployment={syntheticGoldDeployment}
        status="ready"
      />
    );

    // No stale line
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.queryByText("Last update failed; showing the last known data. Retrying.")
    ).toBeNull();

    // Badge has normal emerald style
    const readyBadge = screen.getByText("Healthy");
    expect(readyBadge.className).toContain("bg-emerald-500/15");
    expect(readyBadge.getAttribute("data-stale")).toBeNull();

    // Same for status="loading" with existing snapshot
    rerender(
      <ReactorHealth
        snapshot={snapshot}
        deployment={syntheticGoldDeployment}
        status="loading"
      />
    );
    expect(screen.queryByRole("status")).toBeNull();
    const loadingBadge = screen.getByText("Healthy");
    expect(loadingBadge.className).toContain("bg-emerald-500/15");
    expect(loadingBadge.getAttribute("data-stale")).toBeNull();
  });

  it("hydrates both placeholder and snapshot views cleanly with zero recoverable or console errors", async () => {
    const cases = [
      { label: "placeholder", element: <ReactorHealth deployment={syntheticGoldDeployment} /> },
      {
        label: "error-placeholder",
        element: (
          <ReactorHealth
            deployment={syntheticGoldDeployment}
            status="error"
            error={new GluonError("NODE_ERROR", "network down")}
          />
        ),
      },
      {
        label: "snapshot",
        element: (
          <ReactorHealth
            snapshot={createFakeSnapshot("healthy")}
            deployment={syntheticGoldDeployment}
          />
        ),
      },
      {
        label: "stale-snapshot",
        element: (
          <ReactorHealth
            snapshot={createFakeSnapshot("healthy")}
            deployment={syntheticGoldDeployment}
            status="error"
          />
        ),
      },
    ];

    for (const testCase of cases) {
      const html = renderToString(testCase.element);
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);

      const recoverableErrors: Error[] = [];
      const consoleErrors: string[] = [];
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        consoleErrors.push(args.map(String).join(" "));
        originalConsoleError(...args);
      };

      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, testCase.element, {
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
    }
  });
});

