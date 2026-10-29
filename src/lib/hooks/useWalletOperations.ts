/**
 * @file useWalletOperations.ts
 * @description Hook providing a stable WalletOperations adapter from the active wallet session.
 * @module lib/hooks
 */

import { useErgo } from "@/lib/providers/ErgoProvider";
import type { WalletOperations } from "@/lib/functions/reactor/types";

/**
 * Hook providing a memoized WalletOperations object backed by the current Ergo wallet connection.
 * If the wallet is disconnected when operations are invoked, each method throws "Ergo wallet not connected".
 *
 * @returns Stable WalletOperations adapter.
 */
export function useWalletOperations(): WalletOperations {
  const { walletOps } = useErgo();
  return walletOps;
}

