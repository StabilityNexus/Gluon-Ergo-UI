/**
 * @file eip12-wallet.ts
 * @description Pure adapter mapping EIP-12 window.ergo API to WalletOperations interface.
 * @module lib/utils
 */

import type { Amount, Box, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import type { WalletOperations } from "@/lib/functions/reactor/types";

/**
 * Minimal typed interface for the EIP-12 dApp connector API injected by Ergo wallets (e.g., Nautilus).
 */
export interface Eip12Api {
  get_utxos: () => Promise<Box<Amount>[]>;
  get_change_address: () => Promise<string>;
  sign_tx: (tx: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
  submit_tx: (tx: SignedTransaction) => Promise<string>;
}

/**
 * Creates a WalletOperations adapter around a dynamic EIP-12 wallet provider.
 *
 * Each method evaluates getErgo() at invocation time and throws Error("Ergo wallet not connected")
 * if the wallet is undefined or disconnected.
 *
 * @param getErgo Function returning the currently connected Eip12Api instance or undefined.
 * @returns WalletOperations interface for reactor transaction handlers.
 */
export function createEip12Wallet(getErgo: () => Eip12Api | undefined): WalletOperations {
  const requireErgo = (): Eip12Api => {
    const ergo = getErgo();
    if (!ergo) {
      throw new Error("Ergo wallet not connected");
    }
    return ergo;
  };

  return {
    getUtxos: async (): Promise<Box<Amount>[]> => {
      return requireErgo().get_utxos();
    },
    getChangeAddress: async (): Promise<string> => {
      return requireErgo().get_change_address();
    },
    signTx: async (tx: EIP12UnsignedTransaction): Promise<SignedTransaction> => {
      return requireErgo().sign_tx(tx);
    },
    submitTx: async (tx: SignedTransaction): Promise<string> => {
      return requireErgo().submit_tx(tx);
    },
  };
}

