/**
 * @file balances-listener-ssr.test.tsx
 * @description SSR renderToString probe ensuring zero side-effects and zero calls during server rendering.
 * @module test
 */

import { describe, it, expect, afterAll } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { useWalletBalances } from "@/lib/hooks/useWalletBalances";
import { useTransactionListener } from "@/lib/hooks/useTransactionListener";
import type { TransactionListener } from "@/lib/utils/transaction-listener";

let getUtxosCallCount = 0;
let createListenerCallCount = 0;

import { mock } from "bun:test";
import * as realErgoProvider from "@/lib/providers/ErgoProvider";
const savedRealErgoProvider = { ...realErgoProvider };

mock.module("@/lib/providers/ErgoProvider", () => ({
  ...savedRealErgoProvider,
  useErgo: () => ({
    walletList: [],
    isConnected: true, // Even if true, effects MUST NOT run in SSR
    isInitialized: true,
    isRestoringConnection: false,
    connect: async () => true,
    disconnect: () => {},
    getChangeAddress: async () => "addr1",
    signMessage: async () => "sig",
    getBalance: async () => [],
    getUtxos: async () => {
      getUtxosCallCount++;
      return [];
    },
    SignAndSubmitTx: async () => "txid",
    signTx: async () => ({ id: "tx1", inputs: [], dataInputs: [], outputs: [] }),
    submitTx: async () => "txid",
    ergoWallet: undefined,
  }),
}));

function ServerComponent() {
  const { balances, status } = useWalletBalances();
  const { listener, hasPending } = useTransactionListener({
    createListener: (): TransactionListener => {
      createListenerCallCount++;
      return {} as unknown as TransactionListener;
    },
  });

  return (
    <div data-testid="ssr-probe">
      <span data-testid="status">{status}</span>
      <span data-testid="balances">{balances ? "has-balances" : "no-balances"}</span>
      <span data-testid="listener">{listener ? "has-listener" : "no-listener"}</span>
      <span data-testid="pending">{hasPending ? "pending" : "no-pending"}</span>
    </div>
  );
}

describe("SSR Probe: useWalletBalances and useTransactionListener", () => {
  afterAll(() => {
    mock.module("@/lib/providers/ErgoProvider", () => savedRealErgoProvider);
  });

  it("performs ZERO calls to getUtxos and ZERO createListener calls during renderToString", () => {
    getUtxosCallCount = 0;
    createListenerCallCount = 0;

    const html = renderToString(<ServerComponent />);

    expect(html).toContain("no-balances");
    expect(html).toContain("no-listener");
    expect(getUtxosCallCount).toBe(0);
    expect(createListenerCallCount).toBe(0);
  });
});
