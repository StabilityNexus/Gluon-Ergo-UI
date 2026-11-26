/**
 * @file swapPage.test.tsx
 * @description Integration and hydration tests for SwapPage verifying NetworkGuard, ReactorHealth, AdjustPegPanel, and ReactorSwap integration.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { GluonError, type GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import type { Box, Amount } from "@fleet-sdk/common";
import { ErgoProvider, useErgo } from "@/lib/providers/ErgoProvider";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { useGluon } from "@/lib/hooks/useGluon";
import SwapPage from "@/pages/swap";
import { ScriptedAdjustPegClient } from "./helpers/scriptedAdjustPegClient";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = window.localStorage;
}

function ConnectHelper() {
  const { connect } = useErgo();
  return (
    <button
      type="button"
      data-testid="connect-button"
      onClick={() => {
        void connect("nautilus");
      }}
    >
      Connect Nautilus
    </button>
  );
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

describe("SwapPage Integration Tests", () => {
  const origConnector = window.ergoConnector;

  const dummyBoxes: Box<Amount>[] = [
    {
      boxId: "user-box-swap-page-1",
      value: "10000000000",
      ergoTree: "0008cd",
      creationHeight: 1200000,
      assets: [],
      additionalRegisters: {},
      transactionId: "tx-prev-1",
      index: 0,
    },
  ];

  beforeEach(() => {
    window.localStorage?.clear?.();
    window.ergo = undefined;
    window.ergoConnector = {
      nautilus: {
        connect: async () => true,
        isConnected: async () => false,
      },
    };
  });

  afterEach(() => {
    cleanup();
    window.ergo = undefined;
    window.ergoConnector = origConnector;
    window.localStorage?.clear?.();
  });

  function setupWallet(address: string) {
    window.ergo = {
      get_balance: async () => [],
      get_change_address: async () => address,
      get_unused_addresses: async () => [],
      get_used_addresses: async () => [],
      get_utxos: async () => dummyBoxes,
      get_current_height: async () => 1250000,
      sign_tx: async () => ({
        id: "tx-submitted-page-1",
        inputs: [],
        dataInputs: [],
        outputs: [],
      }),
      submit_tx: async () => "tx-submitted-page-1",
      sign_data: async () => "sig",
    };

    window.ergoConnector = {
      nautilus: {
        connect: async () => true,
        isConnected: async () => true,
      },
    };
  }

  async function renderSwapPage(client: ScriptedAdjustPegClient) {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(
        <ErgoProvider>
          <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
            <ConnectHelper />
            <RefreshHelper />
            <SwapPage />
          </GluonProvider>
        </ErgoProvider>
      );
    });
    return result!;
  }

  it("healthy reactor renders ReactorHealth metrics, swap card, and no AdjustPegPanel", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 0, direction: "down" });
    setupWallet("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v");
    const { container } = await renderSwapPage(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // ReactorHealth elements present
    expect(screen.getByText("Reactor health")).toBeDefined();
    expect(screen.getByText("Prices and the peg")).toBeDefined();
    expect(screen.getByText("Healthy")).toBeDefined();

    // AdjustPegPanel is NOT rendered
    expect(screen.queryByText("Adjust peg")).toBeNull();
    expect(container.innerHTML).not.toContain("Adjust peg");

    // ReactorSwap card is present
    expect(screen.getByRole("heading", { name: "Reactor" })).toBeDefined();
  });

  it("unhealthy reactor renders AdjustPegPanel alongside ReactorHealth", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "down" });
    setupWallet("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v");
    await renderSwapPage(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // ReactorHealth shows outside range
    expect(screen.getByText("Outside the healthy range")).toBeDefined();

    // AdjustPegPanel is visible with heading and button
    expect(screen.getByRole("heading", { name: "Adjust peg" })).toBeDefined();
    expect(screen.getByText("The peg factor will be lowered.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" })).toBeDefined();
  });

  it("connecting with testnet address ('3...') renders blocking NetworkGuard banner and gates actions with 'Wrong network'", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "down" });
    setupWallet("3WwbUQx1thgvN6nSNum9wP");
    await renderSwapPage(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // Blocking NetworkGuard banner is rendered
    expect(
      screen.getByText("Your wallet is not connected to Ergo mainnet. Switch it to mainnet.")
    ).toBeDefined();

    // Both AdjustPeg and Swap buttons are disabled with 'Wrong network'
    const wrongNetworkButtons = screen.getAllByRole("button", { name: "Wrong network" });
    expect(wrongNetworkButtons.length).toBe(2);
    for (const btn of wrongNetworkButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("connecting with mainnet address ('9...') does not render NetworkGuard banner", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "down" });
    setupWallet("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v");
    await renderSwapPage(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    expect(
      screen.queryByText("Your wallet is not connected to Ergo mainnet. Switch it to mainnet.")
    ).toBeNull();

    // Verify Adjust Peg action is available and enabled
    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });
    expect(adjustBtn).toBeDefined();
    expect((adjustBtn as HTMLButtonElement).disabled).toBe(false);

    // Verify no action is gated by "Wrong network"
    expect(screen.queryByRole("button", { name: "Wrong network" })).toBeNull();
  });

  it("surfaces stale warning in ReactorHealth when refresh fails with retained snapshot", async () => {
    let shouldFail = false;
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 0, direction: "down" });
    const originalFetch = client.fetchChainState.bind(client);
    client.fetchChainState = async () => {
      if (shouldFail) {
        throw new Error("Network timeout");
      }
      return originalFetch();
    };

    setupWallet("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v");
    await renderSwapPage(client);

    // Initial render is healthy with no stale warning
    expect(screen.getByText("Healthy")).toBeDefined();
    expect(
      screen.queryByText("Last update failed; showing the last known data. Retrying.")
    ).toBeNull();

    // Trigger refresh that fails
    shouldFail = true;
    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-button"));
    });

    // Stale warning is surfaced in ReactorHealth
    const staleMsg = screen.getByText(
      "Last update failed; showing the last known data. Retrying."
    );
    expect(staleMsg).toBeDefined();
    expect(staleMsg.getAttribute("role")).toBe("status");
    expect(screen.getByText("Healthy")).toBeDefined();
    expect(screen.getByText("Healthy").getAttribute("data-stale")).toBe("true");
  });

  it("surfaces error message in ReactorHealth when initial fetch fails without snapshot", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 0, direction: "down" });
    client.fetchChainState = async () => {
      throw new GluonError("NODE_ERROR", "node unreachable");
    };

    setupWallet("9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v");
    await renderSwapPage(client);

    // Surfaced across ReactorHealth and ReactorSwap banner
    const messages = screen.getAllByText("Reconnecting to the node.");
    expect(messages.length).toBe(2);
    expect(screen.queryByText("Loading reactor data…")).toBeNull();
  });

  it("hydrates cleanly without errors", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 0, direction: "down" });
    const element = (
      <ErgoProvider>
        <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
          <SwapPage />
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
});
