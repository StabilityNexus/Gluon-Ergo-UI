/**
 * @file balances.ts
 * @description Pure functions for summing and transforming wallet UTXO box balances.
 * @module lib/functions/reactor
 */

import type { Amount, Box } from "@fleet-sdk/common";
import type { GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import type { WalletState } from "@/lib/utils/transaction-listener";

/**
 * Aggregated wallet balances: native ERG (in nanoErgs) and token quantities keyed by token ID.
 */
export interface WalletBalances {
  erg: bigint;
  tokens: ReadonlyMap<string, bigint>;
}

/**
 * Aggregates all box values and tokens from a list of UTXOs into a single WalletBalances record.
 * Handles large integers (>2^53) safely via BigInt.
 *
 * @param boxes List of wallet UTXO boxes.
 * @returns Aggregated native ERG and token balances.
 */
export function sumBalances(boxes: Box<Amount>[]): WalletBalances {
  let erg = 0n;
  const tokenMap = new Map<string, bigint>();

  for (const box of boxes) {
    erg += BigInt(box.value);

    if (box.assets && Array.isArray(box.assets)) {
      for (const asset of box.assets) {
        const current = tokenMap.get(asset.tokenId) ?? 0n;
        tokenMap.set(asset.tokenId, current + BigInt(asset.amount));
      }
    }
  }

  return {
    erg,
    tokens: tokenMap,
  };
}

/**
 * Retrieves the balance of a specific token from WalletBalances, returning 0n if not found.
 *
 * @param balances Aggregated wallet balances.
 * @param tokenId Target Ergo token ID.
 * @returns Token balance as bigint.
 */
export function tokenBalance(balances: WalletBalances, tokenId: string): bigint {
  return balances.tokens.get(tokenId) ?? 0n;
}

/**
 * Converts WalletBalances into the array format expected by getBalance() and TransactionListener.
 * Uses "ERG" as the token identifier for native ERG.
 *
 * @param balances Aggregated wallet balances.
 * @returns Array of { tokenId, balance } objects with string balances.
 */
export function toBalanceList(balances: WalletBalances): Array<{ tokenId: string; balance: string }> {
  const list: Array<{ tokenId: string; balance: string }> = [
    {
      tokenId: "ERG",
      balance: balances.erg.toString(),
    },
  ];

  for (const [tokenId, amount] of balances.tokens.entries()) {
    list.push({
      tokenId,
      balance: amount.toString(),
    });
  }

  return list;
}

/**
 * Transforms WalletBalances into a legacy WalletState snapshot for TransactionListener tracking.
 * Maps neutron token to 'gau' and proton token to 'gauc'.
 *
 * @param balances Aggregated wallet balances.
 * @param deployment Active GluonDeployment configuration.
 * @param nowMs Millisecond timestamp for the snapshot.
 * @returns WalletState record formatted with base-unit strings.
 */
export function toWalletState(
  balances: WalletBalances,
  deployment: GluonDeployment,
  nowMs: number
): WalletState {
  const neutronId = deployment.tokens.neutron.id;
  const protonId = deployment.tokens.proton.id;

  return {
    erg: balances.erg.toString(),
    gau: tokenBalance(balances, neutronId).toString(),
    gauc: tokenBalance(balances, protonId).toString(),
    timestamp: nowMs,
  };
}

/**
 * Calculates the available balance for the pair token (min of neutron and proton balances).
 *
 * @param balances Aggregated wallet balances.
 * @param deployment Active GluonDeployment configuration.
 * @returns Minimum of neutron and proton base-unit balances.
 */
export function pairBalance(balances: WalletBalances, deployment: GluonDeployment): bigint {
  const neutrons = tokenBalance(balances, deployment.tokens.neutron.id);
  const protons = tokenBalance(balances, deployment.tokens.proton.id);
  return neutrons < protons ? neutrons : protons;
}

