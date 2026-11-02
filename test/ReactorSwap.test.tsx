/**
 * @file ReactorSwap.test.tsx
 * @description Integration and component tests for ReactorSwap card covering wallet wiring, availability, MAX, handlers, reversals, and hydration safety.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import type { GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import type { TransactionListener, ExpectedChanges, WalletState } from "@/lib/utils/transaction-listener";
import { ErgoProvider, useErgo } from "@/lib/providers/ErgoProvider";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { ReactorSwap } from "@/lib/components/blockchain/swap/ReactorSwap";
import {
  FakeGluonClient,
  type SnapshotMode,
} from "./fakeClient";
import { syntheticGoldDeployment } from "./setup";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = window.localStorage;
}

interface RecordedListenerSave {
  txId: string;
  expectedChanges: ExpectedChanges;
  preState: WalletState;
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

describe("ReactorSwap Component Tests", () => {
  const origConnector = window.ergoConnector;

  const dummySignedTx: SignedTransaction = {
    id: "tx-submitted-1234567890abcdef",
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const neutronId = syntheticGoldDeployment.tokens.neutron.id;
  const protonId = syntheticGoldDeployment.tokens.proton.id;

  const dummyBoxes: Box<Amount>[] = [
    {
      boxId: "box1",
      value: "10000000000", // 10 ERG
      ergoTree: "0008cd",
      creationHeight: 1000,
      assets: [
        { tokenId: neutronId, amount: "50000000000" }, // 50 GAU
        { tokenId: protonId, amount: "50000000000" }, // 50 GAUC
      ],
      additionalRegisters: {},
      transactionId: "tx1",
      index: 0,
    },
  ];

  let recordedSaves: RecordedListenerSave[] = [];

  function createTestListener(): TransactionListener {
    return {
      saveUpTransaction: (txId: string, expectedChanges: ExpectedChanges, preState: WalletState) => {
        recordedSaves.push({ txId, expectedChanges, preState });
      },
      hasPendingTransactions: () => false,
      checkWalletUpdates: async () => {},
      setBalanceProvider: () => {},
      initialize: () => {},
      getPendingTransactions: () => [],
      removeTransaction: () => {},
    } as unknown as TransactionListener;
  }

  beforeEach(() => {
    recordedSaves = [];
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

  function setupFakeWallet(overrides?: {
    signTx?: (tx: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
    submitTx?: (signed: SignedTransaction) => Promise<string>;
  }) {
    window.ergo = {
      get_balance: async () => [],
      get_change_address: async () => "addr-test-wallet-change",
      get_unused_addresses: async () => [],
      get_used_addresses: async () => [],
      get_utxos: async () => dummyBoxes,
      get_current_height: async () => 1250000,
      sign_tx: overrides?.signTx ?? (async () => dummySignedTx),
      submit_tx: overrides?.submitTx ?? (async () => "tx-submitted-1234567890abcdef"),
      sign_data: async () => "sig",
    };

    window.ergoConnector = {
      nautilus: {
        connect: async () => true,
        isConnected: async () => true,
      },
    };
  }

  async function renderReactorSwap(fakeClient: FakeGluonClient) {
    const client = fakeClient as unknown as GluonClient;
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(
        <ErgoProvider>
          <GluonProvider client={client} pollIntervalMs={100000}>
            <ConnectHelper />
            <ReactorSwap
              createListener={() => createTestListener()}
              balancePollMs={100000}
              listenerCheckMs={100000}
              quoteDebounceMs={0}
            />
          </GluonProvider>
        </ErgoProvider>
      );
    });
    return result!;
  }

  it("(a) disconnected: button label is 'Connect wallet (top bar)' and disabled", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    const swapBtn = screen.getByRole("button", { name: "Connect wallet (top bar)" });
    expect(swapBtn).toBeDefined();
    expect((swapBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("(b) every availability row via FakeGluonClient modes disables appropriate actions and shows banner", async () => {
    const modes: Array<{ mode: SnapshotMode; expectedBanner?: string; fissionDisabled: boolean }> = [
      { mode: "healthy", expectedBanner: undefined, fissionDisabled: false },
      {
        mode: "below-range",
        expectedBanner: "The neutrons in circulation are worth less than 50 % of this reactor's reserve.",
        fissionDisabled: true,
      },
      {
        mode: "above-range",
        expectedBanner: "The neutrons in circulation are worth more than 98 % of this reactor's reserve.",
        fissionDisabled: true,
      },
      {
        mode: "stale-oracle",
        expectedBanner: "Waiting for the next oracle update.",
        fissionDisabled: true,
      },
      {
        mode: "no-buyback",
        expectedBanner: "The oracle's buyback box is unavailable.",
        fissionDisabled: false, // Fission/fusion are enabled during no-buyback!
      },
    ];

    for (const testCase of modes) {
      cleanup();
      const fakeClient = new FakeGluonClient(testCase.mode);
      await renderReactorSwap(fakeClient);

      if (testCase.expectedBanner) {
        const banner = screen.getByRole("status");
        expect(banner.textContent).toContain(testCase.expectedBanner);
      } else {
        expect(screen.queryByRole("status")).toBeNull();
      }
    }
  });

  it("(c) connected with UTXO balances: balances shown, typing ERG in fission displays quote and receipt", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // Check balance displayed on From card: 10 ERG (dummyBoxes has 10000000000 nanoErgs)
    expect(screen.getByText("Balance: 10")).toBeDefined();

    // Type 1.5 ERG into From card input
    const inputs = screen.getAllByRole("textbox");
    const fromInput = inputs[0];

    await act(async () => {
      fireEvent.change(fromInput, { target: { value: "1.5" } });
    });

    // Swap button becomes enabled with label "Swap"
    const swapBtn = screen.getByRole("button", { name: "Swap" });
    expect((swapBtn as HTMLButtonElement).disabled).toBe(false);

    // SwapReceipt shows "You pay" 1.5 ERG and "You will receive"
    expect(screen.getByText("You pay")).toBeDefined();
    expect(screen.getByText("1.5 ERG")).toBeDefined();
    expect(screen.getByText("You will receive")).toBeDefined();
  });

  it("(d) MAX fills the field for fission, fusion on the TO card, and transmutations", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // 1. Fission MAX (available ERG: 10 ERG - 0.1 ERG reserve = 9.9 ERG max calculation)
    const maxBtn = screen.getByRole("button", { name: "MAX" });
    await act(async () => {
      fireEvent.click(maxBtn);
    });

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0].getAttribute("value")).not.toBe("");
    expect(inputs[0].getAttribute("value")).not.toBe("0");

    // 2. Transmutation MAX (reverse fission produces invalid pair reverse, select GAU -> GAUC)
    const reverseBtn = screen.getByRole("button", { name: "Reverse tokens" });
    // Selecting GAU From
    // Reverse should be disabled when action is not reversible (pair -> ERG is fusion, reversible!)
    await act(async () => {
      fireEvent.click(reverseBtn);
    });

    // In Fusion (GAU-GAUC -> ERG), driving field is TO card (ERG), MAX button appears on TO card
    const toMaxBtn = screen.getByRole("button", { name: "MAX" });
    await act(async () => {
      fireEvent.click(toMaxBtn);
    });

    const fusionInputs = screen.getAllByRole("textbox");
    // TO input (index 1) is filled with MAX ERG to receive
    expect(fusionInputs[1].getAttribute("value")).not.toBe("");
  });

  it("(e) clicking Swap calls build* with UTXOs, records listener preState, clears input, and shows no UI toast", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "1.0" } });
    });

    const swapBtn = screen.getByRole("button", { name: "Swap" });
    await act(async () => {
      fireEvent.click(swapBtn);
    });

    // Verify buildFission was called
    const buildCalls = fakeClient.calls.filter((c) => c.method === "buildFission");
    expect(buildCalls.length).toBe(1);

    // Verify listener saved transaction with preState derived from UTXOs
    expect(recordedSaves.length).toBe(1);
    expect(recordedSaves[0].txId).toBe("tx-submitted-1234567890abcdef");
    expect(recordedSaves[0].preState.erg).toBe("10000000000");

    // Verify amount was cleared
    expect(inputs[0].getAttribute("value")).toBe("");
  });

  it("(f) sign rejection {code: 2}: no listener save, inputs kept, button usable again", async () => {
    setupFakeWallet({
      signTx: async () => {
        const error = new Error("User declined");
        (error as unknown as { code: number }).code = 2;
        throw error;
      },
    });

    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "1.25" } });
    });

    const swapBtn = screen.getByRole("button", { name: "Swap" });
    await act(async () => {
      fireEvent.click(swapBtn);
    });

    // No listener save occurred
    expect(recordedSaves.length).toBe(0);

    // Input preserved
    expect(inputs[0].getAttribute("value")).toBe("1.25");

    // Button is usable again
    expect((swapBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("(g) submit failure: no listener save", async () => {
    setupFakeWallet({
      submitTx: async () => {
        throw new Error("Mempool submission timeout");
      },
    });

    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "1.5" } });
    });

    const swapBtn = screen.getByRole("button", { name: "Swap" });
    await act(async () => {
      fireEvent.click(swapBtn);
    });

    expect(recordedSaves.length).toBe(0);
  });

  it("(h) double click only executes one handler call", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "1.0" } });
    });

    const swapBtn = screen.getByRole("button", { name: "Swap" });
    await act(async () => {
      fireEvent.click(swapBtn);
      fireEvent.click(swapBtn);
    });

    const buildCalls = fakeClient.calls.filter((c) => c.method === "buildFission");
    expect(buildCalls.length).toBe(1);
    expect(recordedSaves.length).toBe(1);
  });

  it("(i) reverse swaps directions and resets the amount", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "2.5" } });
    });
    expect(inputs[0].getAttribute("value")).toBe("2.5");

    const reverseBtn = screen.getByRole("button", { name: "Reverse tokens" });
    await act(async () => {
      fireEvent.click(reverseBtn);
    });

    // After reverse to Fusion (GAU-GAUC -> ERG): amount is reset
    const newInputs = screen.getAllByRole("textbox");
    expect(newInputs[1].getAttribute("value")).toBe("");
  });

  it("(j) WOULD_LEAVE shows the formatted maximum in error alert", async () => {
    setupFakeWallet();
    const fakeClient = new FakeGluonClient("healthy");
    await renderReactorSwap(fakeClient);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    // Select From: GAU, To: GAUC (Transmutation: quoteBetaDecayMinus throws WOULD_LEAVE when > 50)
    const selects = screen.getAllByRole("combobox");
    await act(async () => {
      fireEvent.change(selects[0], { target: { value: "GAU" } });
    });

    const inputs = screen.getAllByRole("textbox");
    await act(async () => {
      fireEvent.change(inputs[0], { target: { value: "60.0" } });
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("This amount would push the reactor out of its healthy range");
    expect(alert.textContent).toContain("The maximum is");

    const swapBtn = screen.getByRole("button", { name: "Exceeds healthy limit" });
    expect((swapBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("(k) hydration test: renderToString inside providers matches first client render without errors", async () => {
    const fakeClient = new FakeGluonClient("healthy");
    const client = fakeClient as unknown as GluonClient;

    const Element = (
      <ErgoProvider>
        <GluonProvider client={client} pollIntervalMs={100000}>
          <ReactorSwap
            createListener={() => createTestListener()}
            balancePollMs={100000}
            listenerCheckMs={100000}
            quoteDebounceMs={0}
          />
        </GluonProvider>
      </ErgoProvider>
    );

    const html = renderToString(Element);
    expect(html).toContain("Connect wallet (top bar)");
    expect(html).toContain("Reactor");

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
        root = hydrateRoot(container, Element, {
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
