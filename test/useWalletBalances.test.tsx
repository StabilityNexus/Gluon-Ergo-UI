/**
 * @file useWalletBalances.test.tsx
 * @description Unit tests for useWalletBalances hook.
 * @module test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useWalletBalances } from "@/lib/hooks/useWalletBalances";
import type { Box, Amount } from "@fleet-sdk/common";

// Mock state for useErgo
let mockIsConnected = false;
let mockIsRestoringConnection = false;
let mockBoxes: Box<Amount>[] = [];

const mockGetUtxos = async () => mockBoxes;

// Use mock.module to control useErgo in this test file
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
    ergoWallet: undefined,
  }),
}));

describe("useWalletBalances hook", () => {
  beforeEach(() => {
    mockIsConnected = false;
    mockIsRestoringConnection = false;
    mockBoxes = [];
  });

  it("returns initial undefined balances and idle status when disconnected", () => {
    const { result } = renderHook(() => useWalletBalances());
    expect(result.current.balances).toBeUndefined();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("fetches balances immediately when connected", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "5000000000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [{ tokenId: "tok1", amount: "200" }],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    const { result } = renderHook(() => useWalletBalances());

    // Wait for the effect's async fetch to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.balances).toBeDefined();
    expect(result.current.balances?.erg).toBe(5000000000n);
    expect(result.current.balances?.tokens.get("tok1")).toBe(200n);
  });

  it("polls periodically with injected short interval", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    const { result } = renderHook(() => useWalletBalances({ pollIntervalMs: 25 }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.balances?.erg).toBe(1000n);

    // Update the boxes behind the scenes
    mockBoxes = [
      {
        boxId: "box2",
        value: "3000",
        ergoTree: "0008cd",
        creationHeight: 1001,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx2",
        index: 0,
      },
    ];

    // Wait past the polling interval
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(result.current.balances?.erg).toBe(3000n);
  });

  it("allows manual refresh()", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    const { result } = renderHook(() => useWalletBalances());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.balances?.erg).toBe(1000n);

    mockBoxes = [
      {
        boxId: "box2",
        value: "9999",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx2",
        index: 0,
      },
    ];

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.balances?.erg).toBe(9999n);
  });

  it("pauses polling while document.visibilityState is hidden", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    const { result, unmount } = renderHook(() => useWalletBalances({ pollIntervalMs: 20 }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.balances?.erg).toBe(1000n);

    // Set hidden
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    mockBoxes = [
      {
        boxId: "box2",
        value: "5000",
        ergoTree: "0008cd",
        creationHeight: 1001,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx2",
        index: 0,
      },
    ];

    // Wait past the polling interval while hidden
    await act(async () => {
      await new Promise((r) => setTimeout(r, 35));
    });

    // Should NOT have updated yet
    expect(result.current.balances?.erg).toBe(1000n);

    // Make visible again
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.balances?.erg).toBe(5000n);
    unmount();
  });

  it("clears state on disconnect", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "1000",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    const { result, rerender } = renderHook(() => useWalletBalances());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.balances?.erg).toBe(1000n);

    // Disconnect
    mockIsConnected = false;
    rerender();

    expect(result.current.balances).toBeUndefined();
    expect(result.current.status).toBe("idle");
  });

  it("keeps the last good balance value and sets status 'error' when getUtxos fails", async () => {
    mockIsConnected = true;
    mockBoxes = [
      {
        boxId: "box1",
        value: "7777",
        ergoTree: "0008cd",
        creationHeight: 1000,
        assets: [],
        additionalRegisters: {},
        transactionId: "tx1",
        index: 0,
      },
    ];

    let shouldFail = false;
    const failingGetUtxos = async () => {
      if (shouldFail) {
        throw new Error("Wallet communication timed out");
      }
      return mockBoxes;
    };

    const { result } = renderHook(() =>
      useWalletBalances({ getUtxosOverride: failingGetUtxos })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.balances?.erg).toBe(7777n);
    expect(result.current.status).toBe("ready");

    // Next fetch fails
    shouldFail = true;
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Wallet communication timed out");
    // Retains last good value
    expect(result.current.balances?.erg).toBe(7777n);
  });
});
