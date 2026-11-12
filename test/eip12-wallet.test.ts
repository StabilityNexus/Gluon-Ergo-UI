/**
 * @file eip12-wallet.test.ts
 * @description Unit tests for createEip12Wallet adapter.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { createEip12Wallet, type Eip12Api } from "@/lib/utils/eip12-wallet";
import { isWalletCancellation } from "@/lib/utils/error-handler";
import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";

describe("createEip12Wallet", () => {
  const dummyBoxes: Box<Amount>[] = [
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

  it("throws 'Ergo wallet not connected' when getErgo returns undefined at call time", async () => {
    let activeErgo: Eip12Api | undefined = undefined;
    const wallet = createEip12Wallet(() => activeErgo);

    await expect(wallet.getUtxos()).rejects.toThrow("Ergo wallet not connected");
    await expect(wallet.getChangeAddress()).rejects.toThrow("Ergo wallet not connected");
    await expect(wallet.signTx(dummyTx)).rejects.toThrow("Ergo wallet not connected");
    await expect(wallet.submitTx(dummySignedTx)).rejects.toThrow("Ergo wallet not connected");

    // Connects later - now succeeds
    activeErgo = {
      get_utxos: async () => dummyBoxes,
      get_change_address: async () => "9fAddress1",
      sign_tx: async () => dummySignedTx,
      submit_tx: async () => "txid123",
    };

    expect(await wallet.getUtxos()).toEqual(dummyBoxes);
    expect(await wallet.getChangeAddress()).toBe("9fAddress1");
    expect(await wallet.signTx(dummyTx)).toEqual(dummySignedTx);
    expect(await wallet.submitTx(dummySignedTx)).toBe("txid123");
  });

  it("reads window.ergo at call time: replacing window.ergo between two calls uses the new object", async () => {
    let currentErgo: Eip12Api = {
      get_utxos: async () => dummyBoxes,
      get_change_address: async () => "addr1",
      sign_tx: async () => dummySignedTx,
      submit_tx: async () => "tx1",
    };
    const wallet = createEip12Wallet(() => currentErgo);

    expect(await wallet.getChangeAddress()).toBe("addr1");

    // Replace ergo object before next call
    currentErgo = {
      get_utxos: async () => [],
      get_change_address: async () => "addr2",
      sign_tx: async () => dummySignedTx,
      submit_tx: async () => "tx2",
    };

    expect(await wallet.getChangeAddress()).toBe("addr2");
  });

  it("forwards arguments and results correctly when connected", async () => {
    const calls: { method: string; args: unknown[] }[] = [];

    const fakeErgo: Eip12Api = {
      get_utxos: async () => {
        calls.push({ method: "get_utxos", args: [] });
        return dummyBoxes;
      },
      get_change_address: async () => {
        calls.push({ method: "get_change_address", args: [] });
        return "9fTargetAddress";
      },
      sign_tx: async (tx) => {
        calls.push({ method: "sign_tx", args: [tx] });
        return dummySignedTx;
      },
      submit_tx: async (tx) => {
        calls.push({ method: "submit_tx", args: [tx] });
        return "txHashSubmitted";
      },
    };

    const wallet = createEip12Wallet(() => fakeErgo);

    const boxes = await wallet.getUtxos();
    expect(boxes).toEqual(dummyBoxes);
    expect(calls[0]).toEqual({ method: "get_utxos", args: [] });

    const addr = await wallet.getChangeAddress();
    expect(addr).toBe("9fTargetAddress");
    expect(calls[1]).toEqual({ method: "get_change_address", args: [] });

    const signed = await wallet.signTx(dummyTx);
    expect(signed).toEqual(dummySignedTx);
    expect(calls[2]).toEqual({ method: "sign_tx", args: [dummyTx] });

    const txId = await wallet.submitTx(dummySignedTx);
    expect(txId).toBe("txHashSubmitted");
    expect(calls[3]).toEqual({ method: "submit_tx", args: [dummySignedTx] });
  });

  it("passes sign_tx rejection with {code: 2} through unchanged and isWalletCancellation is true", async () => {
    const cancellationError = { code: 2, info: "User rejected the transaction" };

    const fakeErgo: Eip12Api = {
      get_utxos: async () => [],
      get_change_address: async () => "addr",
      sign_tx: async () => {
        throw cancellationError;
      },
      submit_tx: async () => "txId",
    };

    const wallet = createEip12Wallet(() => fakeErgo);

    try {
      await wallet.signTx(dummyTx);
      expect(true).toBe(false); // unreachable
    } catch (err: unknown) {
      expect(err).toBe(cancellationError);
      expect(isWalletCancellation(err)).toBe(true);
    }
  });

  it("passes submit_tx rejection with {code: 2} through without adding cancellation logic", async () => {
    const submitError = { code: 2, info: "Submit error from node" };

    const fakeErgo: Eip12Api = {
      get_utxos: async () => [],
      get_change_address: async () => "addr",
      sign_tx: async () => dummySignedTx,
      submit_tx: async () => {
        throw submitError;
      },
    };

    const wallet = createEip12Wallet(() => fakeErgo);

    try {
      await wallet.submitTx(dummySignedTx);
      expect(true).toBe(false); // unreachable
    } catch (err: unknown) {
      expect(err).toBe(submitError);
    }
  });
});

