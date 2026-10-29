/**
 * @file constants.ts
 * @description Constants for reactor swap operations and UI reserve buffers.
 * @module lib/functions/reactor
 */

/**
 * Minimum ERG reserve (0.1 ERG = 100_000_000 nanoErgs) retained in the user's wallet
 * when computing MAX for fission and transaction execution.
 * Cites the legacy MIN_ERG_BUFFER (0.1 ERG) so users retain sufficient ERG to pay future
 * network and execution fees.
 */
export const MIN_ERG_RESERVE = 100_000_000n;

