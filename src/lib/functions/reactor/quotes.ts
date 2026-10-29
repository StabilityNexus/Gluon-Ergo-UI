/**
 * @file quotes.ts
 * @description Safe calculation of swap quotes using exact SDK methods and base units without throwing.
 * @module lib/functions/reactor
 *
 * NOTE on Fusion input (per Phase 1f analysis):
 * In SDK 2.0.1, `quoteFusion(chain, erg)` takes the amount of ERG the user wants to receive from fusing
 * the neutron and proton pair tokens. The parameter is therefore named `ergToReceiveText`.
 */
import { GluonError, type ActionQuote, type ChainState } from "@stability-nexus/gluon-ergo-sdk";
import { toBaseUnits } from "@/lib/utils/amounts";
import type { SwapClient } from "./types";

export type QuoteResult =
  | { ok: true; quote: ActionQuote }
  | { ok: false; kind: "invalid-input"; message: string }
  | { ok: false; kind: "gluon"; error: GluonError }
  | { ok: false; kind: "unexpected"; error: Error };

function parseInputAmount(text: string, decimals: number): { amount: bigint } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed === ".") {
    return { error: "Amount cannot be empty" };
  }

  try {
    const amount = toBaseUnits(trimmed, decimals);
    if (amount <= 0n) {
      return { error: "Amount must be greater than zero" };
    }
    return { amount };
  } catch {
    return { error: `Invalid numeric input: "${text}"` };
  }
}

export function getFissionQuote(client: SwapClient, chain: ChainState, ergText: string): QuoteResult {
  const parsed = parseInputAmount(ergText, 9);
  if ("error" in parsed) {
    return { ok: false, kind: "invalid-input", message: parsed.error };
  }

  try {
    const quote = client.quoteFission(chain, parsed.amount);
    return { ok: true, quote };
  } catch (err: unknown) {
    if (err instanceof GluonError) {
      return { ok: false, kind: "gluon", error: err };
    }
    return { ok: false, kind: "unexpected", error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function getFusionQuote(client: SwapClient, chain: ChainState, ergToReceiveText: string): QuoteResult {
  const parsed = parseInputAmount(ergToReceiveText, 9);
  if ("error" in parsed) {
    return { ok: false, kind: "invalid-input", message: parsed.error };
  }

  try {
    const quote = client.quoteFusion(chain, parsed.amount);
    return { ok: true, quote };
  } catch (err: unknown) {
    if (err instanceof GluonError) {
      return { ok: false, kind: "gluon", error: err };
    }
    return { ok: false, kind: "unexpected", error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function getTransmuteToPegQuote(
  client: SwapClient,
  chain: ChainState,
  protonText: string,
  protonDecimals: number
): QuoteResult {
  const parsed = parseInputAmount(protonText, protonDecimals);
  if ("error" in parsed) {
    return { ok: false, kind: "invalid-input", message: parsed.error };
  }

  try {
    const quote = client.quoteBetaDecayPlus(chain, parsed.amount);
    return { ok: true, quote };
  } catch (err: unknown) {
    if (err instanceof GluonError) {
      return { ok: false, kind: "gluon", error: err };
    }
    return { ok: false, kind: "unexpected", error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function getTransmuteFromPegQuote(
  client: SwapClient,
  chain: ChainState,
  neutronText: string,
  neutronDecimals: number
): QuoteResult {
  const parsed = parseInputAmount(neutronText, neutronDecimals);
  if ("error" in parsed) {
    return { ok: false, kind: "invalid-input", message: parsed.error };
  }

  try {
    const quote = client.quoteBetaDecayMinus(chain, parsed.amount);
    return { ok: true, quote };
  } catch (err: unknown) {
    if (err instanceof GluonError) {
      return { ok: false, kind: "gluon", error: err };
    }
    return { ok: false, kind: "unexpected", error: err instanceof Error ? err : new Error(String(err)) };
  }
}
