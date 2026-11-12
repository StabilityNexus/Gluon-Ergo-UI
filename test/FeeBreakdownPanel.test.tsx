/**
 * @file FeeBreakdownPanel.test.tsx
 * @description Unit and hydration tests for FeeBreakdownPanel presentational component.
 * @module test
 */

import { describe, it, expect, afterEach } from "bun:test";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { FeeBreakdownPanel } from "@/lib/components/blockchain/swap/FeeBreakdownPanel";
import type { ActionQuote } from "@stability-nexus/gluon-ergo-sdk";

describe("FeeBreakdownPanel", () => {
  afterEach(cleanup);

  const sampleFees: ActionQuote["fees"] = {
    dev: 5000000n, // 0.005 ERG
    ui: 0n,
    oracle: 2000000n, // 0.002 ERG
    outputsMinFee: 1000000n, // 0.001 ERG
    miner: 3000000n, // 0.003 ERG
    total: 11000000n, // 0.011 ERG
  };

  it("renders all fee rows, formatted values, and total correctly", () => {
    render(<FeeBreakdownPanel fees={sampleFees} />);

    expect(screen.getByText("Dev fee")).toBeDefined();
    expect(screen.getByText("0.005 ERG")).toBeDefined();

    expect(screen.getByText("Oracle fee")).toBeDefined();
    expect(screen.getByText("0.002 ERG")).toBeDefined();

    expect(screen.getByText("Fee output boxes")).toBeDefined();
    expect(screen.getByText("0.001 ERG")).toBeDefined();

    expect(screen.getByText("Miner fee")).toBeDefined();
    expect(screen.getByText("0.003 ERG")).toBeDefined();

    expect(screen.getByText("Total fees")).toBeDefined();
    expect(screen.getByText("0.011 ERG")).toBeDefined();
  });

  it("does not render any USD or Interface fee text", () => {
    const { container } = render(<FeeBreakdownPanel fees={sampleFees} />);
    const text = container.textContent || "";

    expect(text).not.toContain("USD");
    expect(text).not.toContain("$");
    expect(text).not.toContain("Interface");
    expect(text).not.toContain("UI fee");
    expect(text).not.toContain("Price impact");
  });

  it("hydrates without any recoverable errors or mismatch warnings", async () => {
    const html = renderToString(<FeeBreakdownPanel fees={sampleFees} />);
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = html;

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
        root = hydrateRoot(container, <FeeBreakdownPanel fees={sampleFees} />, {
          onRecoverableError(error) {
            recoverableErrors.push(error as Error);
          },
        });
      });

      expect(recoverableErrors).toHaveLength(0);
      const mismatchErrors = consoleErrors.filter(
        (msg) =>
          msg.toLowerCase().includes("hydrat") || msg.toLowerCase().includes("did not match")
      );
      expect(mismatchErrors).toHaveLength(0);
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
      console.error = originalConsoleError;
    }
  });
});
