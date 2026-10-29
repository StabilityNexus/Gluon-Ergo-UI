/**
 * @file useWalletOperations.test.tsx
 * @description Hook tests for useWalletOperations and ErgoProvider wallet adapter operations.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { ErgoProvider, useErgo } from "@/lib/providers/ErgoProvider";
import { useWalletOperations } from "@/lib/hooks/useWalletOperations";
import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = window.localStorage;
}

describe("useWalletOperations", () => {
  const origErgo = window.ergo;
  const origConnector = window.ergoConnector;

  const dummyTx: EIP12UnsignedTransaction = {
    id: "tx-unsigned-1",
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const dummySignedTx: SignedTransaction = {
    id: "tx-signed-1",
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const dummyBoxes: Box<Amount>[] = [
    {
      boxId: "box1",
      value: "2000000000",
      ergoTree: "0008cd",
      creationHeight: 1000,
      assets: [],
      additionalRegisters: {},
      transactionId: "tx1",
      index: 0,
    },
  ];

  beforeEach(() => {
    window.localStorage?.clear?.();
  });

  afterEach(() => {
    window.ergo = origErgo;
    window.ergoConnector = origConnector;
    window.localStorage?.clear?.();
  });

  it("throws 'Ergo wallet not connected' when disconnected in rendered ErgoProvider", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ErgoProvider>{children}</ErgoProvider>
    );

    const { result } = renderHook(() => useWalletOperations(), { wrapper });

    expect(typeof result.current.getUtxos).toBe("function");
    expect(typeof result.current.getChangeAddress).toBe("function");
    expect(typeof result.current.signTx).toBe("function");
    expect(typeof result.current.submitTx).toBe("function");

    await expect(result.current.getUtxos()).rejects.toThrow("Ergo wallet not connected");
    await expect(result.current.getChangeAddress()).rejects.toThrow("Ergo wallet not connected");
    await expect(result.current.signTx(dummyTx)).rejects.toThrow("Ergo wallet not connected");
    await expect(result.current.submitTx(dummySignedTx)).rejects.toThrow("Ergo wallet not connected");
  });

  it("returns a referentially stable object across re-renders", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ErgoProvider>{children}</ErgoProvider>
    );

    const { result, rerender } = renderHook(() => useWalletOperations(), { wrapper });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);

    rerender();
    expect(result.current).toBe(first);
  });

  it("getUtxos, signTx, submitTx, and SignAndSubmitTx work through a rendered ErgoProvider when connected", async () => {
    window.ergo = {
      get_balance: async () => [],
      get_change_address: async () => "addr-test-123",
      get_unused_addresses: async () => [],
      get_used_addresses: async () => [],
      get_utxos: async () => dummyBoxes,
      get_current_height: async () => 1000,
      sign_tx: async () => dummySignedTx,
      submit_tx: async () => "tx-submitted-hash",
      sign_data: async () => "sig",
    };

    window.ergoConnector = {
      nautilus: {
        connect: async () => true,
        isConnected: async () => true,
      },
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ErgoProvider>{children}</ErgoProvider>
    );

    const { result } = renderHook(
      () => {
        const ergo = useErgo();
        const ops = useWalletOperations();
        return { ergo, ops };
      },
      { wrapper }
    );

    // Connect wallet
    await act(async () => {
      const ok = await result.current.ergo.connect("nautilus");
      expect(ok).toBe(true);
    });

    expect(result.current.ergo.isConnected).toBe(true);

    // Call through walletOps from useWalletOperations
    const boxes = await result.current.ops.getUtxos();
    expect(boxes).toEqual(dummyBoxes);

    const addr = await result.current.ops.getChangeAddress();
    expect(addr).toBe("addr-test-123");

    const signed = await result.current.ops.signTx(dummyTx);
    expect(signed).toEqual(dummySignedTx);

    const txId = await result.current.ops.submitTx(dummySignedTx);
    expect(txId).toBe("tx-submitted-hash");

    // Call SignAndSubmitTx through provider
    const signAndSubmitId = await result.current.ergo.SignAndSubmitTx(dummyTx);
    expect(signAndSubmitId).toBe("tx-submitted-hash");
  });
});
