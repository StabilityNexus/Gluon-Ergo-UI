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

  it("hydrates both placeholder and snapshot views cleanly with zero recoverable or console errors", async () => {
    const cases = [
      { label: "placeholder", element: <ReactorHealth deployment={syntheticGoldDeployment} /> },
      {
        label: "snapshot",
        element: (
          <ReactorHealth
            snapshot={createFakeSnapshot("healthy")}
            deployment={syntheticGoldDeployment}
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

