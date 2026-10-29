/**
 * @file useTransactionListener.test.tsx
 * @description Unit tests for useTransactionListener hook covering lifecycle, balance wiring, polling, cleanup, and SSR probe.
 * @module test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { useTransactionListener } from "@/lib/hooks/useTransactionListener";
import type { TransactionListener } from "@/lib/utils/transaction-listener";
import type { Box, Amount } from "@fleet-sdk/common";

let mockIsConnected = false;
let mockIsRestoringConnection = false;
let mockBoxes: Box<Amount>[] = [];

const mockGetUtxos = async () => mockBoxes;

import { mock } from "bun:test";
mock.module("@/lib/providers/ErgoProvider", () => ({
  useErgo: () => ({
    walletList: [],
    isConnected: mockIsConnected,
    isInitialized: true,
    isRestoringConnection: mockIsRestoringConnection,
    connect: async () => true,
    disconnect: () => {},
    getChangeAddress: async () => "addr1",
    signMessage: async () => "sig",
    getBalance: async () => [],
    getUtxos: mockGetUtxos,
    SignAndSubmitTx: async () => "txid",
    signTx: async () => ({ id: "tx1", inputs: [], dataInputs: [], outputs: [] }),
    submitTx: async () => "txid",
    walletOps: {
      getUtxos: mockGetUtxos,
      getChangeAddress: async () => "addr1",
      signTx: async () => ({ id: "tx1", inputs: [], dataInputs: [], outputs: [] }),
      submitTx: async () => "txid",
    },
    ergoWallet: undefined,
  }),
}));

describe("useTransactionListener hook", () => {
  beforeEach(() => {
    mockIsConnected = false;
    mockIsRestoringConnection = false;
    mockBoxes = [];
  });

  it("does not create a listener when disconnected", () => {
    let createCount = 0;
    const fakeFactory = (): TransactionListener => {
      createCount++;
      return {} as unknown as TransactionListener;
    };

    const { result } = renderHook(() =>
      useTransactionListener({ createListener: fakeFactory })
    );

    expect(result.current.listener).toBeUndefined();
    expect(result.current.hasPending).toBe(false);
    expect(createCount).toBe(0);
  });

  it("balance provider output equals toBalanceList of the fake UTXOs and wires initialize", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "4000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [{ tokenId: "tokA", amount: "50" }],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    let initialized = false;
    let balanceProviderFn: (() => Promise<Array<{ tokenId: string; balance: string }>>) | undefined;

    const fakeListener: Partial<TransactionListener> = {
      setBalanceProvider: (fn) => {
        balanceProviderFn = fn;
      },
      initialize: () => {
        initialized = true;
      },
      hasPendingTransactions: () => false,
      checkWalletUpdates: async () => {},
    };

    const { result } = renderHook(() =>
      useTransactionListener({
        createListener: () => fakeListener as TransactionListener,
        checkIntervalMs: 50,
      })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(initialized).toBe(true);
    expect(result.current.listener).toBe(fakeListener as TransactionListener);

    // Verify balance provider output equals toBalanceList of the fake UTXOs
    expect(balanceProviderFn).toBeDefined();
    const providedBalances = await balanceProviderFn!();
    expect(providedBalances).toEqual([
      { tokenId: "ERG", balance: "4000000" },
      { tokenId: "tokA", balance: "50" },
    ]);
  });

  it("checkWalletUpdates is called on the interval (checkIntervalMs=10) and hasPending reflects hasPendingTransactions", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "1000000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    let checkWalletUpdatesCount = 0;
    let pendingStatus = true;

    const fakeListener: Partial<TransactionListener> = {
      setBalanceProvider: () => {},
      initialize: () => {},
      hasPendingTransactions: () => pendingStatus,
      checkWalletUpdates: async (fn) => {
        checkWalletUpdatesCount++;
        const b = await fn();
        expect(b).toEqual([{ tokenId: "ERG", balance: "1000000000" }]);
        // Next check finds no pending transactions
        pendingStatus = false;
      },
    };

    const { result, unmount } = renderHook(() =>
      useTransactionListener({
        createListener: () => fakeListener as TransactionListener,
        checkIntervalMs: 10,
      })
    );

    // Mount settling
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(result.current.hasPending).toBe(true);

    // Wait for periodic checkWalletUpdates at checkIntervalMs=10
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });

    expect(checkWalletUpdatesCount).toBeGreaterThanOrEqual(1);
    expect(result.current.hasPending).toBe(false);
    unmount();
  });

  it("timers cleared on unmount and on disconnect", async () => {
    mockIsConnected = true;

    let clearIntervalCount = 0;
    const origClearInterval = globalThis.clearInterval;
    globalThis.clearInterval = function (
      id: Parameters<typeof origClearInterval>[0]
    ): void {
      clearIntervalCount++;
      return origClearInterval(id);
    } as typeof clearInterval;

    try {
      const fakeListener: Partial<TransactionListener> = {
        setBalanceProvider: () => {},
        initialize: () => {},
        hasPendingTransactions: () => false,
        checkWalletUpdates: async () => {},
      };

      const { unmount, rerender } = renderHook(
        ({ connected }: { connected: boolean }) => {
          mockIsConnected = connected;
          return useTransactionListener({
            createListener: () => fakeListener as TransactionListener,
            checkIntervalMs: 20,
          });
        },
        { initialProps: { connected: true } }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });

      // Disconnect triggers effect cleanup and clears interval
      rerender({ connected: false });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      expect(clearIntervalCount).toBeGreaterThanOrEqual(1);

      // Reconnect
      rerender({ connected: true });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });

      // Unmount triggers cleanup
      const prevCount = clearIntervalCount;
      unmount();
      expect(clearIntervalCount).toBeGreaterThan(prevCount);
    } finally {
      globalThis.clearInterval = origClearInterval;
    }
  });

  it("createListener called exactly once per connected session and again after disconnect/reconnect", async () => {
    mockIsConnected = true;
    let createCount = 0;

    const fakeListener: Partial<TransactionListener> = {
      setBalanceProvider: () => {},
      initialize: () => {},
      hasPendingTransactions: () => false,
      checkWalletUpdates: async () => {},
    };

    const fakeFactory = (): TransactionListener => {
      createCount++;
      return fakeListener as TransactionListener;
    };

    const { rerender } = renderHook(
      ({ connected }: { connected: boolean }) => {
        mockIsConnected = connected;
        return useTransactionListener({
          createListener: fakeFactory,
          checkIntervalMs: 50,
        });
      },
      { initialProps: { connected: true } }
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(createCount).toBe(1);

    // Rerender while still connected: does NOT recreate listener
    rerender({ connected: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(createCount).toBe(1);

    // Disconnect
    rerender({ connected: false });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(createCount).toBe(1);

    // Reconnect: creates new listener for the new session
    rerender({ connected: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(createCount).toBe(2);
  });

  it("nothing is created before effects (renderToString probe)", () => {
    mockIsConnected = true;
    let createCount = 0;

    const fakeFactory = (): TransactionListener => {
      createCount++;
      return {} as unknown as TransactionListener;
    };

    function ServerListenerComponent() {
      const { listener, hasPending } = useTransactionListener({
        createListener: fakeFactory,
      });

      return (
        <div data-testid="listener-ssr">
          <span data-testid="hasListener">{listener ? "yes" : "no"}</span>
          <span data-testid="hasPending">{hasPending ? "yes" : "no"}</span>
        </div>
      );
    }

    const html = renderToString(<ServerListenerComponent />);
    expect(html).toContain("no");
    expect(createCount).toBe(0);
  });
});
