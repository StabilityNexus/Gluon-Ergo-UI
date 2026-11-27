/**
 * @file network.ts
 * @description Pure helper for validating whether a wallet change address belongs to Ergo mainnet.
 * @module lib/functions/reactor
 */

/**
 * Checks whether an address is an Ergo mainnet P2PK address (trimmed, non-empty, starts with "9").
 * Note: the Gluon SDK also enforces mainnet addresses and throws INVALID_ADDRESS for non-mainnet ones.
 */
export function isMainnetAddress(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }
  const trimmed = address.trim();
  return trimmed.length > 0 && trimmed.startsWith("9");
}

