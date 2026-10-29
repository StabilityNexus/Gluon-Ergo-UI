/**
 * @file limits.ts
 * @description Pure BigInt functions calculating swap MAX limits bounded against user balances and protocol constraints.
 * Uses conservative change-box rule: leftover ERG must be >= SAFE_MIN_BOX_VALUE (zero-leftover exact spend is excluded).
 * @module lib/functions/reactor
 */
import type { ChainState } from "@stability-nexus/gluon-ergo-sdk";
import type { SwapClient } from "./types";

/**
 * Safe minimum box value per Ergo protocol & EIP-12 standard.
 * Sourced from @fleet-sdk/core SAFE_MIN_BOX_VALUE (1000000n nanoERG),
 * cited in SDK select.js:1,115,137 and client.js:1,404,421,445,465.
 */
export const SAFE_MIN_BOX_VALUE = 1000000n;
export const MAX_BINARY_SEARCH_ITERATIONS = 64;

/**
 * Shared helper implementing the conservative change-box rule:
 * - When neededErg === 0n, there is no ERG constraint (valid).
 * - When neededErg > 0n, leftover (walletErg - neededErg) must be >= SAFE_MIN_BOX_VALUE.
 */
export function hasValidChange(walletErg: bigint, neededErg: bigint): boolean {
  if (neededErg === 0n) return true;
  if (walletErg < neededErg) return false;
  return walletErg - neededErg >= SAFE_MIN_BOX_VALUE;
}

/**
 * Verifies whether a fission amount can be built without throwing INSUFFICIENT_FUNDS.
 * Conservative rule: leftover ERG in wallet must be >= SAFE_MIN_BOX_VALUE for a valid change box.
 */
export function isFissionAmountAllowed(
  client: SwapClient,
  chain: ChainState,
  amount: bigint,
  walletErg: bigint
): boolean {
  if (amount <= 0n) return false;
  try {
    const quote = client.quoteFission(chain, amount);
    const neededErg = amount + SAFE_MIN_BOX_VALUE + quote.fees.total;
    return hasValidChange(walletErg, neededErg);
  } catch {
    return false;
  }
}

/**
 * Calculates the maximum ERG amount that can be deposited for fission,
 * strictly bounded by the conservative change-box rule (leftover >= SAFE_MIN_BOX_VALUE)
 * so buildFission will not throw INSUFFICIENT_FUNDS.
 */
export function calculateFissionMax(client: SwapClient, chain: ChainState, walletErg: bigint): bigint {
  if (walletErg <= SAFE_MIN_BOX_VALUE * 2n) {
    return 0n;
  }

  let low = 0n;
  let high = walletErg;
  let safeChangeMax = 0n;

  for (let i = 0; i < MAX_BINARY_SEARCH_ITERATIONS && low <= high; i++) {
    const mid = (low + high + 1n) / 2n;
    try {
      const quote = client.quoteFission(chain, mid);
      const neededErg = mid + SAFE_MIN_BOX_VALUE + quote.fees.total;
      if (hasValidChange(walletErg, neededErg)) {
        safeChangeMax = mid;
        low = mid + 1n;
      } else {
        high = mid - 1n;
      }
    } catch {
      high = mid - 1n;
    }
  }

  return safeChangeMax;
}

/**
 * Calculates the maximum ERG amount obtainable from fusion,
 * derived from token ratios for 1 ERG and fine-tuned with bounded binary search (64 iterations).
 * Note: When wallet's ERG is provided and neededErg > 0, leftover must be >= SAFE_MIN_BOX_VALUE.
 * When neededErg is 0 there is no ERG constraint.
 */
export function calculateFusionMax(
  client: SwapClient,
  chain: ChainState,
  walletNeutrons: bigint,
  walletProtons: bigint,
  walletErg?: bigint
): bigint {
  if (walletNeutrons <= 0n || walletProtons <= 0n) {
    return 0n;
  }

  const oneErg = 1000000000n;
  let neutronsPerErg: bigint;
  let protonsPerErg: bigint;

  try {
    const q1 = client.quoteFusion(chain, oneErg);
    neutronsPerErg = q1.neutronsIn;
    protonsPerErg = q1.protonsIn;
  } catch {
    return 0n;
  }

  if (neutronsPerErg <= 0n || protonsPerErg <= 0n) {
    return 0n;
  }

  const maxFromNeutrons = (walletNeutrons * oneErg) / neutronsPerErg;
  const maxFromProtons = (walletProtons * oneErg) / protonsPerErg;
  let high = maxFromNeutrons < maxFromProtons ? maxFromNeutrons : maxFromProtons;

  if (high <= 0n) {
    return 0n;
  }

  let low = 0n;
  let best = 0n;

  for (let i = 0; i < MAX_BINARY_SEARCH_ITERATIONS && low <= high; i++) {
    const mid = (low + high + 1n) / 2n;

    try {
      const quote = client.quoteFusion(chain, mid);
      const tokensSufficient = quote.neutronsIn <= walletNeutrons && quote.protonsIn <= walletProtons;

      let ergSufficient = true;
      if (walletErg !== undefined) {
        const totalNeeded = SAFE_MIN_BOX_VALUE + quote.fees.total;
        const neededErg = totalNeeded > mid ? totalNeeded - mid : 0n;
        ergSufficient = hasValidChange(walletErg, neededErg);
      }

      if (tokensSufficient && ergSufficient) {
        best = mid;
        low = mid + 1n;
      } else {
        high = mid - 1n;
      }
    } catch {
      high = mid - 1n;
    }
  }

  return best;
}

/**
 * Calculates the maximum protons that can be transmuted to neutrons.
 */
export function calculateTransmuteToPegMax(client: SwapClient, chain: ChainState, walletProtons: bigint): bigint {
  if (walletProtons <= 0n) {
    return 0n;
  }

  let maxAllowed: bigint;
  try {
    maxAllowed = client.maxBetaDecayPlus(chain);
  } catch {
    return 0n;
  }

  const limit = walletProtons < maxAllowed ? walletProtons : maxAllowed;
  return limit > 0n ? limit : 0n;
}

/**
 * Calculates the maximum neutrons that can be transmuted to protons.
 */
export function calculateTransmuteFromPegMax(client: SwapClient, chain: ChainState, walletNeutrons: bigint): bigint {
  if (walletNeutrons <= 0n) {
    return 0n;
  }

  let maxAllowed: bigint;
  try {
    maxAllowed = client.maxBetaDecayMinus(chain);
  } catch {
    return 0n;
  }

  const limit = walletNeutrons < maxAllowed ? walletNeutrons : maxAllowed;
  return limit > 0n ? limit : 0n;
}
