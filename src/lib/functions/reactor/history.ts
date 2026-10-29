/**
 * @file history.ts
 * @description Pure functions mapping swap quotes to TransactionListener ExpectedChanges data model.
 * @module lib/functions/reactor
 *
 * MAPPING SPECIFICATION & 1c DECISION:
 * -------------------------------------------------------------
 * Step 1c analysis of src/lib/utils/transaction-listener.ts showed:
 * - calculateExpectedState runs:
 *     erg: (BigInt(preState.erg) + BigInt(changes.erg) + BigInt(changes.fees)).toString()
 *     gau: (BigInt(preState.gau) + BigInt(changes.gau)).toString()
 *     gauc: (BigInt(preState.gauc) + BigInt(changes.gauc)).toString()
 * - compareStatesWithTolerance performs BigInt diffs between current wallet state and expected state.
 * - TransactionCard formats expectedChanges via nanoErgsToErgs() which assumes base units (nano-units).
 *
 * If formatted decimal strings (e.g. "1.5") were passed to ExpectedChanges:
 *   1. BigInt("1.5") would throw SyntaxError in calculateExpectedState.
 *   2. nanoErgsToErgs("1.5") would divide an already-decimal value by 1e9 in TransactionCard.
 *   3. Transactions would never confirm because diffs compare base units to decimal numbers.
 *
 * Therefore, "amounts as the listener expects them" are integer base units represented as strings:
 * - formatUnits(value, 0) is used (0 decimals = integer base units), avoiding any floating point or Number() conversion.
 * - Stable token (neutron) maps to listener's legacy 'gau' field.
 * - Volatile token (proton) maps to listener's legacy 'gauc' field.
 * - ERG changes map to 'erg'.
 * - Total fees map to 'fees' and are always negative.
 *
 * SIGN CONVENTIONS:
 * - FISSION:
 *     erg:   (-quote.ergIn).toString()      [negative: ERG deposited]
 *     gau:   quote.neutronsOut.toString()   [positive: neutrons received]
 *     gauc:  quote.protonsOut.toString()    [positive: protons received]
 *     fees:  (-quote.fees.total).toString() [negative: ERG fees paid]
 *
 * - FUSION:
 *     erg:   quote.ergOut.toString()        [positive: ERG redeemed]
 *     gau:   (-quote.neutronsIn).toString() [negative: neutrons spent]
 *     gauc:  (-quote.protonsIn).toString()  [negative: protons spent]
 *     fees:  (-quote.fees.total).toString() [negative: ERG fees paid]
 *
 * - TRANSMUTE_TO_PEG (Beta Decay Plus):
 *     erg:   "0"                            [0 ERG traded]
 *     gau:   quote.neutronsOut.toString()   [positive: neutrons received]
 *     gauc:  (-quote.protonsIn).toString()  [negative: protons spent]
 *     fees:  (-quote.fees.total).toString() [negative: ERG fees paid]
 *
 * - TRANSMUTE_FROM_PEG (Beta Decay Minus):
 *     erg:   "0"                            [0 ERG traded]
 *     gau:   (-quote.neutronsIn).toString() [negative: neutrons spent]
 *     gauc:  quote.protonsOut.toString()    [positive: protons received]
 *     fees:  (-quote.fees.total).toString() [negative: ERG fees paid]
 */

import type { ActionQuote, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { ExpectedChanges } from "@/lib/utils/transaction-listener";
import { formatUnits } from "@/lib/utils/amounts";

/**
 * Builds the ExpectedChanges object required by TransactionListener.saveUpTransaction.
 *
 * @param actionType The swap action type
 * @param quote The ActionQuote returned by GluonClient
 * @param deployment The GluonDeployment configuration (used for metadata/token config)
 * @returns ExpectedChanges object formatted for TransactionListener
 */
export function buildExpectedChanges(
  actionType: ActionType | string,
  quote: ActionQuote,
  _deployment?: GluonDeployment
): ExpectedChanges {
  void _deployment;
  // Uses formatUnits with 0 decimals to produce safe BigInt base-unit string without Number()
  const toBaseStr = (value: bigint): string => formatUnits(value, 0);

  const fees = toBaseStr(-quote.fees.total);

  if (actionType === ACTION_TYPES.FISSION || actionType === "fission") {
    return {
      erg: toBaseStr(-quote.ergIn),
      gau: toBaseStr(quote.neutronsOut),
      gauc: toBaseStr(quote.protonsOut),
      fees,
    };
  }

  if (actionType === ACTION_TYPES.FUSION || actionType === "fusion") {
    return {
      erg: toBaseStr(quote.ergOut),
      gau: toBaseStr(-quote.neutronsIn),
      gauc: toBaseStr(-quote.protonsIn),
      fees,
    };
  }

  if (
    actionType === ACTION_TYPES.TRANSMUTE_TO_PEG ||
    actionType === "transmute_to_peg" ||
    actionType === "transmute-to-gold" ||
    actionType === "beta_decay_plus"
  ) {
    return {
      erg: "0",
      gau: toBaseStr(quote.neutronsOut),
      gauc: toBaseStr(-quote.protonsIn),
      fees,
    };
  }

  if (
    actionType === ACTION_TYPES.TRANSMUTE_FROM_PEG ||
    actionType === "transmute_from_peg" ||
    actionType === "transmute-from-gold" ||
    actionType === "beta_decay_minus"
  ) {
    return {
      erg: "0",
      gau: toBaseStr(-quote.neutronsIn),
      gauc: toBaseStr(quote.protonsOut),
      fees,
    };
  }

  throw new Error(`Unsupported action type for history: ${actionType}`);
}
