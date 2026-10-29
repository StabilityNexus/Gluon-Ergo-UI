/**
 * @file useSwapQuote.ts
 * @description Hook providing debounced quote calculations with stale result prevention and immediate recomputation on chain/action changes.
 * @module lib/hooks
 */

import { useState, useEffect, useRef } from "react";
import type { ChainState, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES, type ActionType } from "@/lib/constants/token";
import type { SwapClient } from "@/lib/functions/reactor/types";
import {
  getFissionQuote,
  getFusionQuote,
  getTransmuteToPegQuote,
  getTransmuteFromPegQuote,
  type QuoteResult,
} from "@/lib/functions/reactor/quotes";

export interface UseSwapQuoteOptions {
  client?: SwapClient;
  chain?: ChainState;
  action: ActionType | null;
  amountText: string;
  deployment: GluonDeployment;
  debounceMs?: number;
}

export type QuoteStatus = "idle" | "pending" | "ready";

export interface UseSwapQuoteResult {
  status: QuoteStatus;
  result?: QuoteResult;
}

interface QuoteKey {
  amountText: string;
  action: ActionType;
  chain: ChainState;
}

/**
 * Calculates swap quotes with text debounce, cancellation flags, and immediate re-runs
 * when chain state or action type updates.
 *
 * Keeps the last valid quote result in state while a new quote is pending.
 *
 * @param options Swap quote configuration options.
 * @returns {UseSwapQuoteResult} Current status ("idle" | "pending" | "ready") and quote result.
 */
export function useSwapQuote({
  client,
  chain,
  action,
  amountText,
  deployment,
  debounceMs = 300,
}: UseSwapQuoteOptions): UseSwapQuoteResult {
  const [result, setResult] = useState<QuoteResult | undefined>(undefined);
  const [quotedFor, setQuotedFor] = useState<QuoteKey | null>(null);

  // Track previous dependencies to distinguish text-only changes from action/chain updates
  const prevRef = useRef<{
    amountText: string;
    action: ActionType | null;
    chain?: ChainState;
  }>({
    amountText: "",
    action,
    chain,
  });

  const isIdle = !client || !chain || !action || !amountText.trim();
  const isReady =
    !isIdle &&
    quotedFor !== null &&
    quotedFor.amountText === amountText &&
    quotedFor.action === action &&
    quotedFor.chain === chain;

  const status: QuoteStatus = isIdle ? "idle" : isReady ? "ready" : "pending";

  useEffect(() => {
    // If essential parameters are missing or amount is empty, revert to idle
    if (isIdle) {
      prevRef.current = { amountText, action, chain };
      return;
    }

    const prev = prevRef.current;
    const isTextOnlyChange =
      prev.amountText !== amountText && prev.action === action && prev.chain === chain;
    prevRef.current = { amountText, action, chain };

    // Debounce only when text alone changes. Action or chain transitions recompute immediately.
    const delay = isTextOnlyChange ? debounceMs : 0;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const executeQuote = (): void => {
      let quoteRes: QuoteResult;

      try {
        if (action === ACTION_TYPES.FISSION) {
          quoteRes = getFissionQuote(client, chain, amountText);
        } else if (action === ACTION_TYPES.FUSION) {
          quoteRes = getFusionQuote(client, chain, amountText);
        } else if (action === ACTION_TYPES.TRANSMUTE_TO_PEG) {
          quoteRes = getTransmuteToPegQuote(
            client,
            chain,
            amountText,
            deployment.tokens.proton.decimals
          );
        } else if (action === ACTION_TYPES.TRANSMUTE_FROM_PEG) {
          quoteRes = getTransmuteFromPegQuote(
            client,
            chain,
            amountText,
            deployment.tokens.neutron.decimals
          );
        } else {
          quoteRes = {
            ok: false,
            kind: "unexpected",
            error: new Error(`Unsupported swap action: ${String(action)}`),
          };
        }
      } catch (err: unknown) {
        if (err instanceof GluonError) {
          quoteRes = { ok: false, kind: "gluon", error: err };
        } else {
          quoteRes = {
            ok: false,
            kind: "unexpected",
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
      }

      // Discard result if effect was cancelled by a newer keystroke before completion
      if (!cancelled) {
        setResult(quoteRes);
        setQuotedFor({ amountText, action, chain });
      }
    };

    if (delay > 0) {
      timerId = setTimeout(() => {
        executeQuote();
      }, delay);
    } else {
      executeQuote();
    }

    return () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [client, chain, action, amountText, deployment, debounceMs, isIdle]);

  return {
    status,
    result: isIdle ? undefined : result,
  };
}
