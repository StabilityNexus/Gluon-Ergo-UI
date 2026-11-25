/**
 * @file fakeWallet.ts
 * @description Shared fake EIP-12 wallet setup and teardown helpers for new tests.
 * @module test/helpers
 */

import type { Box, Amount, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";

export interface FakeWalletOverrides {
  getChangeAddress?: () => Promise<string>;
  getUtxos?: () => Promise<Box<Amount>[]>;
  signTx?: (tx: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
  submitTx?: (signed: SignedTransaction) => Promise<string>;
  isConnected?: () => Promise<boolean>;
  connect?: () => Promise<boolean>;
}

const DEFAULT_SIGNED_TX: SignedTransaction = {
  id: "tx-submitted-1234567890abcdef",
  inputs: [],
  dataInputs: [],
  outputs: [],
};

export function setupDisconnectedWalletConnector(): void {
  window.localStorage?.clear?.();
  window.ergo = undefined;
  window.ergoConnector = {
    nautilus: {
      connect: async () => true,
      isConnected: async () => false,
    },
  };
}

export function setupFakeWallet(overrides?: FakeWalletOverrides): void {
  window.ergo = {
    get_balance: async () => [],
    get_change_address:
      overrides?.getChangeAddress ??
      (async () => "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v"),
    get_unused_addresses: async () => [],
    get_used_addresses: async () => [],
    get_utxos: overrides?.getUtxos ?? (async () => []),
    get_current_height: async () => 1250000,
    sign_tx: overrides?.signTx ?? (async () => DEFAULT_SIGNED_TX),
    submit_tx: overrides?.submitTx ?? (async () => "tx-submitted-1234567890abcdef"),
    sign_data: async () => "sig",
  };

  window.ergoConnector = {
    nautilus: {
      connect: overrides?.connect ?? (async () => true),
      isConnected: overrides?.isConnected ?? (async () => true),
    },
  };
}

export function teardownFakeWallet(origConnector: typeof window.ergoConnector): void {
  window.ergo = undefined;
  window.ergoConnector = origConnector;
  window.localStorage?.clear?.();
}
