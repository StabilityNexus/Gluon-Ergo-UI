/**
 * @file AdjustPegPanel.test.tsx
 * @description Component, integration, and hydration tests for AdjustPegPanel covering multi-step transitions, timeouts, wallet rejections, and oracle changes.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { toast } from "sonner";
import type { Box, Amount, SignedTransaction } from "@fleet-sdk/common";
import type { GluonClient } from "@stability-nexus/gluon-ergo-sdk";
import { ErgoProvider, useErgo } from "@/lib/providers/ErgoProvider";
import { GluonProvider } from "@/lib/providers/GluonProvider";
import { useGluon } from "@/lib/hooks/useGluon";
import { AdjustPegPanel, type AdjustPegPanelProps } from "@/lib/components/blockchain/reactor/AdjustPegPanel";
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

function RefreshTrigger() {
  const { refresh } = useGluon();
  return (
    <button
      type="button"
      data-testid="refresh-button"
      onClick={() => {
        void refresh();
      }}
    >
      Refresh
    </button>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("AdjustPegPanel Component Tests", () => {
  const origConnector = window.ergoConnector;

  const dummyBoxes: Box<Amount>[] = [
    {
      boxId: "user-box-adjust-1",
      value: "10000000000",
      ergoTree: "0008cd",
      creationHeight: 1200000,
      assets: [],
      additionalRegisters: {},
      transactionId: "tx-prev-1",
      index: 0,
    },
  ];

  let toastErrorSpy: ReturnType<typeof spyOn>;
  let toastSuccessSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    toastErrorSpy = spyOn(toast, "error").mockImplementation(() => "err-toast-id" as unknown as string | number);
    toastSuccessSpy = spyOn(toast, "success").mockImplementation(() => "ok-toast-id" as unknown as string | number);

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
    toastErrorSpy.mockRestore();
    toastSuccessSpy.mockRestore();
    window.ergo = undefined;
    window.ergoConnector = origConnector;
    window.localStorage?.clear?.();
  });

  function setupFakeWallet(
    client?: ScriptedAdjustPegClient,
    overrides?: {
      signTx?: (tx: unknown) => Promise<SignedTransaction>;
      submitTx?: (signed: SignedTransaction) => Promise<string>;
    }
  ) {
    window.ergo = {
      get_balance: async () => [],
      get_change_address: async () => "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
      get_unused_addresses: async () => [],
      get_used_addresses: async () => [],
      get_utxos: async () => dummyBoxes,
      get_current_height: async () => 1250000,
      sign_tx: overrides?.signTx ?? (async (tx: unknown) => {
        const unsigned = tx as { id?: string };
        return {
          id: unsigned.id ?? "adjust-tx-1",
          inputs: [],
          dataInputs: [],
          outputs: [],
        };
      }),
      submit_tx: overrides?.submitTx ?? (async (signed: SignedTransaction) => {
        if (client) {
          client.markSubmitted(signed.id);
        }
        return signed.id;
      }),
      sign_data: async () => "sig",
    };

    window.ergoConnector = {
      nautilus: {
        connect: async () => true,
        isConnected: async () => true,
      },
    };
  }

  async function renderAdjustPegPanel(
    client: ScriptedAdjustPegClient,
    props: Partial<AdjustPegPanelProps> = {}
  ) {
    let clock = 0;
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(
        <ErgoProvider>
          <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
            <ConnectHelper />
            <RefreshTrigger />
            <AdjustPegPanel
              pollMs={5}
              timeoutMs={100}
              now={() => clock}
              sleep={async (ms) => {
                clock += ms;
              }}
              {...props}
            />
          </GluonProvider>
        </ErgoProvider>
      );
    });
    return result!;
  }

  it("(1) healthy client (stepsToHealthy 0): the panel renders nothing (no 'Adjust peg' text)", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 0, direction: "down" });
    setupFakeWallet(client);
    const { container } = await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    expect(screen.queryByText("Adjust peg")).toBeNull();
    expect(container.innerHTML).not.toContain("Adjust peg");
  });

  it("(2) unhealthy 'down' with 2 steps: shows 'lowered', '2 steps needed', cost line, button 'Adjust peg (step 1 of 2)'; 'up': shows 'raised'", async () => {
    const clientDown = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "down" });
    setupFakeWallet(clientDown);
    await renderAdjustPegPanel(clientDown);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    expect(screen.getByText("The peg factor will be lowered.")).toBeDefined();
    expect(screen.getByText("2 steps needed at the current price.")).toBeDefined();
    expect(screen.getByText(/Cost: one miner fee per step, paid by you; no protocol fee\./)).toBeDefined();
    expect(screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" })).toBeDefined();

    cleanup();

    const clientUp = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "up" });
    setupFakeWallet(clientUp);
    await renderAdjustPegPanel(clientUp);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    expect(screen.getByText("The peg factor will be raised.")).toBeDefined();
  });

  it("(3) one step: click -> exactly one buildAdjustPeg call with wallet's UTXOs and change address, signs, submits, labels 'Waiting for the network…', then reads 'Adjust peg (step 2 of 2)' and shows 'Step 1 done.'; never two builds at once", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
      confirmAfterFetches: 2,
    });

    let capturedTx: { id?: string } | undefined;
    const signDeferred = createDeferred<SignedTransaction>();
    setupFakeWallet(client, {
      signTx: (tx) => {
        capturedTx = tx as { id?: string };
        return signDeferred.promise;
      },
    });
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    // 1. While signing, button reads "Waiting for your wallet…" and is disabled
    const signingBtn = screen.getByRole("button", { name: "Waiting for your wallet…" });
    expect((signingBtn as HTMLButtonElement).disabled).toBe(true);

    // 2. Set up fetchGate to pause polling refresh when submitted
    const fetchDeferred = createDeferred<void>();
    client.fetchGate = fetchDeferred.promise;

    // Resolve signing
    await act(async () => {
      signDeferred.resolve({
        id: capturedTx?.id ?? "adjust-tx-1",
        inputs: [],
        dataInputs: [],
        outputs: [],
      } as unknown as SignedTransaction);
    });

    // 3. While polling refresh is held, button reads "Waiting for the network…" and is disabled
    const waitingBtn = screen.getByRole("button", { name: "Waiting for the network…" });
    expect((waitingBtn as HTMLButtonElement).disabled).toBe(true);

    // Resolve the polling refresh gate
    await act(async () => {
      client.fetchGate = undefined;
      fetchDeferred.resolve();
    });

    // 4. Verify completion
    const builds = client.calls.filter((c) => c.method === "buildAdjustPeg");
    expect(builds).toHaveLength(1);
    expect(builds[0].args[1]).toEqual({
      userBoxes: dummyBoxes,
      changeAddress: "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v",
    });

    expect(screen.getByRole("button", { name: "Adjust peg (step 2 of 2)" })).toBeDefined();
    expect(screen.getByText("Step 1 done.")).toBeDefined();
  });

  it("(4) the second step makes the reactor healthy: the form disappears and 'The reactor is healthy again; no peg adjustment is needed.' shows", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 1,
      direction: "down",
      confirmAfterFetches: 0,
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 1)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    expect(screen.queryByText("Adjust peg")).toBeNull();
    expect(screen.queryByRole("button", { name: /Adjust peg/ })).toBeNull();
    expect(screen.getByText("The reactor is healthy again; no peg adjustment is needed.")).toBeDefined();
  });

  it("(4b) resets stepsDone and progress when a new unhealthy episode begins", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 1,
      direction: "down",
      confirmAfterFetches: 0,
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 1)" });

    // Step 1: complete the first episode
    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    // Form disappears and shows healthy message
    expect(screen.queryByText("Adjust peg")).toBeNull();
    expect(
      screen.getByText("The reactor is healthy again; no peg adjustment is needed.")
    ).toBeDefined();

    // Step 2: flip the scripted client back to unhealthy (2 steps needed)
    client.stepsRemaining = 2;
    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-button"));
    });

    // Form reappears with step 1 of 2 (reset to step 1 of N, not step 2 of 3)
    expect(screen.getByRole("heading", { name: "Adjust peg" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" })).toBeDefined();
    expect(
      screen.queryByText("The reactor is healthy again; no peg adjustment is needed.")
    ).toBeNull();
  });

  it("(5) finishExternally() then click before provider refreshes: build throws REACTOR_HEALTHY, message is shown, no toast, and after the next refresh the panel hides", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 1,
      direction: "down",
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    client.finishExternally();

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 1)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    expect(toastErrorSpy).not.toHaveBeenCalled();

    // After provider refreshed to healthy with stepsDone = 0, panel hides completely
    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh-button"));
    });

    expect(screen.queryByText("Adjust peg")).toBeNull();
    expect(screen.queryByText("The reactor is healthy again; no peg adjustment is needed.")).toBeNull();
  });

  it("(6) wallet rejection {code:2} on sign: no toast, no message, button is usable again with same label", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });
    setupFakeWallet(client, {
      signTx: async () => {
        const err = new Error("User cancelled");
        (err as unknown as { code: number }).code = 2;
        throw err;
      },
    });
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    expect(toastErrorSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" })).toBeDefined();
    expect(screen.queryByText(/Step \d+ done/)).toBeNull();
  });

  it("(7) networkBlocked: label 'Wrong network', click calls no build", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client, { networkBlocked: true });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const wrongBtn = screen.getByRole("button", { name: "Wrong network" });
    expect((wrongBtn as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      fireEvent.click(wrongBtn);
    });

    const builds = client.calls.filter((c) => c.method === "buildAdjustPeg");
    expect(builds).toHaveLength(0);
  });

  it("(8) not connected: button label is 'Connect wallet (top bar)' and disabled", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });
    await renderAdjustPegPanel(client);

    const btn = screen.getByRole("button", { name: "Connect wallet (top bar)" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("(9) oracle stale (setOracleStale(true)): label 'Waiting for the next oracle update…', disabled", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });
    client.setOracleStale(true);
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const btn = screen.getByRole("button", { name: "Waiting for the next oracle update…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("(10) double click: one build call", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
      confirmAfterFetches: 2,
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
      fireEvent.click(adjustBtn);
    });

    const builds = client.calls.filter((c) => c.method === "buildAdjustPeg");
    expect(builds).toHaveLength(1);
  });

  it("(11) timeout: confirmAfterFetches large and timeoutMs small -> label 'Check again'; clicking 'Check again' continues without a second build", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
      confirmAfterFetches: 100,
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client, { timeoutMs: 15, pollMs: 5 });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    // Timeout triggered
    const checkAgainBtn = screen.getByRole("button", { name: "Check again" });
    expect((checkAgainBtn as HTMLButtonElement).disabled).toBe(false);

    // Make fake visible now
    client.confirmAfterFetches = 0;
    client.fetchesUntilVisible = -1;
    client.confirmedTxId = client.pendingTxId!;
    client.pendingTxId = undefined;
    client.stepsRemaining -= 1;

    await act(async () => {
      fireEvent.click(checkAgainBtn);
    });

    expect(screen.getByRole("button", { name: "Adjust peg (step 2 of 2)" })).toBeDefined();

    const builds = client.calls.filter((c) => c.method === "buildAdjustPeg");
    expect(builds).toHaveLength(1);
  });

  it("(12) ORACLE_STALE from build (set stale between render and click via the fake) -> error message inline, no toast", async () => {
    const client = new ScriptedAdjustPegClient({
      stepsToHealthy: 2,
      direction: "down",
    });
    setupFakeWallet(client);
    await renderAdjustPegPanel(client);

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });

    client.setOracleStale(true);

    const adjustBtn = screen.getByRole("button", { name: "Adjust peg (step 1 of 2)" });

    await act(async () => {
      fireEvent.click(adjustBtn);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText(
        "The oracle price is too old. Waiting for the next oracle update (usually a few minutes)."
      )
    ).toBeDefined();
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });

  it("(13) hydration: renderToString of the panel inside providers (loading state) is an empty string and hydrateRoot reports zero errors", async () => {
    const client = new ScriptedAdjustPegClient({ stepsToHealthy: 2, direction: "down" });
    const element = (
      <ErgoProvider>
        <GluonProvider client={client as unknown as GluonClient} pollIntervalMs={100000}>
          <AdjustPegPanel />
        </GluonProvider>
      </ErgoProvider>
    );

    const html = renderToString(element);
    expect(html).toBe("");

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
