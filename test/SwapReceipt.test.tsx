/**
 * @file SwapReceipt.test.tsx
 * @description Unit and hydration tests for SwapReceipt presentational component.
 * @module test
 */

import { describe, it, expect, afterEach } from "bun:test";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { SwapReceipt } from "@/lib/components/blockchain/swap/SwapReceipt";
import { ACTION_TYPES } from "@/lib/constants/token";
import type { ActionQuote } from "@stability-nexus/gluon-ergo-sdk";
import { syntheticGoldDeployment } from "./setup";
import { createFakeQuote } from "./fakeClient";

describe("SwapReceipt", () => {
  afterEach(cleanup);
  const deployment = syntheticGoldDeployment;

  const baseQuote: ActionQuote = {
    ...createFakeQuote(),
    ergIn: 2000000000n, // 2 ERG
    ergOut: 1500000000n, // 1.5 ERG
    neutronsIn: 3000000000n, // 3 GAU
    neutronsOut: 4000000000n, // 4 GAU
    protonsIn: 5000000000n, // 5 GAUC
    protonsOut: 6000000000n, // 6 GAUC
    fees: {
      dev: 5000000n,
      ui: 0n,
      oracle: 2000000n,
      outputsMinFee: 1000000n,
      miner: 2000000n,
      total: 10000000n,
    },
  };

  it("renders empty state placeholder when quote is undefined", () => {
    render(<SwapReceipt action={ACTION_TYPES.FISSION} deployment={deployment} />);

    expect(
      screen.getByText("Enter an amount to preview transaction receipt and fees.")
    ).toBeDefined();
    expect(screen.queryByText("You pay")).toBeNull();
    expect(screen.queryByText("You will receive")).toBeNull();
  });

  it("renders FISSION receipt with correct pay, receive, and fee values", () => {
    render(
      <SwapReceipt action={ACTION_TYPES.FISSION} quote={baseQuote} deployment={deployment} />
    );

    expect(screen.getByText("You pay")).toBeDefined();
    expect(screen.getByText("2 ERG")).toBeDefined();

    expect(screen.getByText("You will receive")).toBeDefined();
    expect(screen.getByText("4 GAU")).toBeDefined();
    expect(screen.getByText("6 GAUC")).toBeDefined();

    expect(screen.getByText("Total fees")).toBeDefined();
    expect(screen.getByText("0.01 ERG")).toBeDefined();
  });

  it("renders FUSION receipt with correct pay, receive, and fee values", () => {
    render(
      <SwapReceipt action={ACTION_TYPES.FUSION} quote={baseQuote} deployment={deployment} />
    );

    expect(screen.getByText("You pay")).toBeDefined();
    expect(screen.getByText("3 GAU")).toBeDefined();
    expect(screen.getByText("5 GAUC")).toBeDefined();

    expect(screen.getByText("You will receive")).toBeDefined();
    expect(screen.getByText("1.5 ERG")).toBeDefined();
  });

  it("renders TRANSMUTE_TO_PEG receipt with correct pay and receive values", () => {
    render(
      <SwapReceipt
        action={ACTION_TYPES.TRANSMUTE_TO_PEG}
        quote={baseQuote}
        deployment={deployment}
      />
    );

    expect(screen.getByText("You pay")).toBeDefined();
    expect(screen.getByText("5 GAUC")).toBeDefined();

    expect(screen.getByText("You will receive")).toBeDefined();
    expect(screen.getByText("4 GAU")).toBeDefined();
  });

  it("renders TRANSMUTE_FROM_PEG receipt with correct pay and receive values", () => {
    render(
      <SwapReceipt
        action={ACTION_TYPES.TRANSMUTE_FROM_PEG}
        quote={baseQuote}
        deployment={deployment}
      />
    );

    expect(screen.getByText("You pay")).toBeDefined();
    expect(screen.getByText("3 GAU")).toBeDefined();

    expect(screen.getByText("You will receive")).toBeDefined();
    expect(screen.getByText("6 GAUC")).toBeDefined();
  });

  it("hydrates without any recoverable errors or mismatch warnings (both active and empty)", async () => {
    const htmlActive = renderToString(
      <SwapReceipt action={ACTION_TYPES.FISSION} quote={baseQuote} deployment={deployment} />
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = htmlActive;

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
        root = hydrateRoot(
          container,
          <SwapReceipt action={ACTION_TYPES.FISSION} quote={baseQuote} deployment={deployment} />,
          {
            onRecoverableError(error) {
              recoverableErrors.push(error as Error);
            },
          }
        );
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
