/**
 * @file NetworkGuard.test.tsx
 * @description Component and hydration tests for NetworkGuard banner.
 * @module test
 */

import { describe, it, expect, afterEach } from "bun:test";
import React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { NetworkGuard } from "@/lib/components/blockchain/reactor/NetworkGuard";

describe("NetworkGuard Component Tests", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders blocking role='alert' banner with exact text for 'wrong-network'", () => {
    render(<NetworkGuard status="wrong-network" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(
      "Your wallet is not connected to Ergo mainnet. Switch it to mainnet."
    );
  });

  it("renders nothing for 'unknown' and 'mainnet'", () => {
    const { container: unknownContainer } = render(<NetworkGuard status="unknown" />);
    expect(unknownContainer.innerHTML).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();

    cleanup();

    const { container: mainnetContainer } = render(<NetworkGuard status="mainnet" />);
    expect(mainnetContainer.innerHTML).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hydrates cleanly for unknown, mainnet, and wrong-network without errors", async () => {
    const statuses = ["unknown", "mainnet", "wrong-network"] as const;

    for (const status of statuses) {
      const element = <NetworkGuard status={status} />;
      const html = renderToString(element);
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
    }
  });
});

