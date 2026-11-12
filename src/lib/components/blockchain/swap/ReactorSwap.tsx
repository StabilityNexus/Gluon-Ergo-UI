/**
 * @file ReactorSwap.tsx
 * @description Reactor Swap card wiring hooks, view-model reducer, MAX computation, action gating, and transaction execution.
 * @module lib/components/blockchain/swap
 */

import React, { useReducer, useMemo, useRef, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import type { GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import type { NodeService } from "@/lib/utils/node-service";
import type { TransactionListener } from "@/lib/utils/transaction-listener";
import { ACTION_TYPES } from "@/lib/constants/token";
import { useGluon } from "@/lib/hooks/useGluon";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { useWalletOperations } from "@/lib/hooks/useWalletOperations";
import { useWalletBalances } from "@/lib/hooks/useWalletBalances";
import { useTransactionListener } from "@/lib/hooks/useTransactionListener";
import { useSwapQuote } from "@/lib/hooks/useSwapQuote";
import {
  swapReducer,
  createInitialSwapState,
  drivingField,
  computeMax,
  formatMaxAmount,
} from "@/lib/functions/reactor/swapModel";
import { getSwapAvailability } from "@/lib/functions/reactor/availability";
import {
  defaultTokens,
  getValidToTokens,
  getActionType,
  getTitle,
  getDescription,
} from "@/lib/functions/reactor/utils";
import { describeQuote } from "@/lib/functions/reactor/describeQuote";
import {
  sumBalances,
  tokenBalance,
  pairBalance,
  toWalletState,
  type WalletBalances,
} from "@/lib/functions/reactor/balances";
import { getSwapButtonState } from "@/lib/functions/reactor/swapButtonState";
import { handleFissionSwap } from "@/lib/functions/reactor/handleFission";
import { handleFusionSwap } from "@/lib/functions/reactor/handleFusion";
import { handleTransmutationSwap } from "@/lib/functions/reactor/handleTransmutation";
import type { SwapClient, SwapHandlerResult } from "@/lib/functions/reactor/types";
import { toBaseUnits, formatUnits } from "@/lib/utils/amounts";
import { cn } from "@/lib/utils/utils";
import { SwapTokenCard, type PairBreakdownItem } from "./SwapTokenCard";
import { SwapReceipt } from "./SwapReceipt";
import { Card, CardHeader, CardContent } from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";

export interface ReactorSwapProps {
  createListener?: (nodeService: NodeService) => TransactionListener;
  balancePollMs?: number;
  listenerCheckMs?: number;
  quoteDebounceMs?: number;
  className?: string;
}

function getTokenBalanceText(
  symbol: string,
  balances: WalletBalances | undefined,
  deployment: GluonDeployment
): string {
  if (!balances) return "—";
  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  if (symbol === "ERG") {
    return formatUnits(balances.erg, 9);
  }
  if (symbol === neutronName) {
    return formatUnits(
      tokenBalance(balances, deployment.tokens.neutron.id),
      deployment.tokens.neutron.decimals
    );
  }
  if (symbol === protonName) {
    return formatUnits(
      tokenBalance(balances, deployment.tokens.proton.id),
      deployment.tokens.proton.decimals
    );
  }
  if (symbol === pairSymbol) {
    return formatUnits(pairBalance(balances, deployment), deployment.tokens.neutron.decimals);
  }
  return "—";
}

/**
 * ReactorSwap card orchestrating swap state, quotes, validation, and transaction execution.
 * Fully hydration-safe: initial SSR render produces identical markup to disconnected / loading client state.
 */
export function ReactorSwap({
  createListener,
  balancePollMs,
  listenerCheckMs,
  quoteDebounceMs,
  className,
}: ReactorSwapProps) {
  const { client, chain, snapshot, status, error, refresh, deployment } = useGluon();
  const { isConnected, isInitialized, isRestoringConnection } = useErgo();
  const walletReady = isInitialized && !isRestoringConnection;

  const wallet = useWalletOperations();
  const balancesResult = useWalletBalances({ pollIntervalMs: balancePollMs });
  const { balances, status: balanceStatus } = balancesResult;
  const balancesReady = isConnected && walletReady && balanceStatus === "ready" && balances !== undefined;

  const listenerResult = useTransactionListener({
    createListener,
    checkIntervalMs: listenerCheckMs,
  });
  const { listener, hasPending, refreshPending } = listenerResult;
  const listenerReady = isConnected && walletReady && listener !== undefined;

  const [state, dispatch] = useReducer(swapReducer, deployment, createInitialSwapState);

  const availability = useMemo(
    () => getSwapAvailability({ snapshot, status, error }),
    [snapshot, status, error]
  );

  const action = useMemo(
    () => getActionType(state.fromSymbol, state.toSymbol, deployment),
    [state.fromSymbol, state.toSymbol, deployment]
  );

  const swapClient = client as SwapClient;

  const quote = useSwapQuote({
    client: swapClient,
    chain,
    action,
    amountText: state.amountText,
    deployment,
    debounceMs: quoteDebounceMs,
  });

  const driving = drivingField(action);

  const allTokens = useMemo(() => defaultTokens(deployment), [deployment]);
  const validToTokens = useMemo(
    () => getValidToTokens(state.fromSymbol, allTokens, deployment),
    [state.fromSymbol, allTokens, deployment]
  );

  const reverseAction = useMemo(
    () => getActionType(state.toSymbol, state.fromSymbol, deployment),
    [state.fromSymbol, state.toSymbol, deployment]
  );
  const isReverseDisabled = reverseAction === null;

  const isBlocked = useMemo(() => {
    if (!action) return true;
    switch (action) {
      case ACTION_TYPES.FISSION:
        return !availability.fission;
      case ACTION_TYPES.FUSION:
        return !availability.fusion;
      case ACTION_TYPES.TRANSMUTE_TO_PEG:
        return !availability.transmuteToPeg;
      case ACTION_TYPES.TRANSMUTE_FROM_PEG:
        return !availability.transmuteFromPeg;
      default:
        return true;
    }
  }, [availability, action]);

  const fromDecimals = useMemo(() => {
    if (state.fromSymbol === "ERG") return 9;
    if (state.fromSymbol === deployment.tokens.neutron.name) return deployment.tokens.neutron.decimals;
    if (state.fromSymbol === deployment.tokens.proton.name) return deployment.tokens.proton.decimals;
    return deployment.tokens.neutron.decimals;
  }, [state.fromSymbol, deployment]);

  const toDecimals = useMemo(() => {
    if (state.toSymbol === "ERG") return 9;
    if (state.toSymbol === deployment.tokens.neutron.name) return deployment.tokens.neutron.decimals;
    if (state.toSymbol === deployment.tokens.proton.name) return deployment.tokens.proton.decimals;
    return deployment.tokens.neutron.decimals;
  }, [state.toSymbol, deployment]);

  const maxBaseUnits = useMemo(() => {
    if (!chain || !balances || !action) {
      return undefined;
    }
    return computeMax({
      action,
      client: swapClient,
      chain,
      balances,
      deployment,
    });
  }, [swapClient, chain, balances, action, deployment]);

  const maxDrivingDecimals = driving === "from" ? fromDecimals : toDecimals;
  const maxText = useMemo(() => {
    if (maxBaseUnits === undefined) return undefined;
    return formatMaxAmount(maxBaseUnits, maxDrivingDecimals);
  }, [maxBaseUnits, maxDrivingDecimals]);

  const limits = useMemo((): { exceeds: "none" | "balance" | "max" } => {
    if (quote.status !== "ready" || !quote.result?.ok || !action || !balances || !chain) {
      return { exceeds: "none" };
    }

    const q = quote.result.quote;
    const neutronId = deployment.tokens.neutron.id;
    const protonId = deployment.tokens.proton.id;
    const walletNeutrons = tokenBalance(balances, neutronId);
    const walletProtons = tokenBalance(balances, protonId);
    const walletErg = balances.erg;

    switch (action) {
      case ACTION_TYPES.FISSION: {
        if (q.ergIn > walletErg) {
          return { exceeds: "balance" };
        }
        if (maxBaseUnits !== undefined && q.ergIn > maxBaseUnits) {
          return { exceeds: "max" };
        }
        return { exceeds: "none" };
      }
      case ACTION_TYPES.FUSION: {
        if (q.neutronsIn > walletNeutrons || q.protonsIn > walletProtons) {
          return { exceeds: "balance" };
        }
        if (maxBaseUnits !== undefined && q.ergOut > maxBaseUnits) {
          return { exceeds: "max" };
        }
        return { exceeds: "none" };
      }
      case ACTION_TYPES.TRANSMUTE_TO_PEG: {
        if (q.protonsIn > walletProtons) {
          return { exceeds: "balance" };
        }
        if (maxBaseUnits !== undefined && q.protonsIn > maxBaseUnits) {
          return { exceeds: "max" };
        }
        return { exceeds: "none" };
      }
      case ACTION_TYPES.TRANSMUTE_FROM_PEG: {
        if (q.neutronsIn > walletNeutrons) {
          return { exceeds: "balance" };
        }
        if (maxBaseUnits !== undefined && q.neutronsIn > maxBaseUnits) {
          return { exceeds: "max" };
        }
        return { exceeds: "none" };
      }
      default:
        return { exceeds: "none" };
    }
  }, [quote, action, balances, chain, deployment, maxBaseUnits]);

  const inFlightRef = useRef(false);
  const [inProgress, setInProgress] = useState(false);

  const buttonState = useMemo(() => {
    return getSwapButtonState({
      connected: isConnected,
      walletReady,
      balancesReady,
      listenerReady,
      availability,
      action,
      amountText: state.amountText,
      quote,
      limits,
      max: maxBaseUnits,
      maxText,
      decimals: maxDrivingDecimals,
      inProgress,
      hasPending,
    });
  }, [
    isConnected,
    walletReady,
    balancesReady,
    listenerReady,
    availability,
    action,
    state.amountText,
    quote,
    limits,
    maxBaseUnits,
    maxText,
    maxDrivingDecimals,
    inProgress,
    hasPending,
  ]);

  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pairSymbol = `${neutronName}-${protonName}`;

  // Compute displayed values for each card
  const fromCardValue = useMemo(() => {
    if (driving === "from") {
      return state.amountText;
    }
    if (quote.status === "ready" && quote.result?.ok && action) {
      const desc = describeQuote(action, quote.result.quote, deployment);
      if (desc.pay.length === 2) {
        return `${desc.pay[0].amount} ${desc.pay[0].symbol} + ${desc.pay[1].amount} ${desc.pay[1].symbol}`;
      }
      return desc.pay[0]?.amount ?? "";
    }
    return "";
  }, [driving, state.amountText, quote, action, deployment]);

  const toCardValue = useMemo(() => {
    if (driving === "to") {
      return state.amountText;
    }
    if (quote.status === "ready" && quote.result?.ok && action) {
      const desc = describeQuote(action, quote.result.quote, deployment);
      if (desc.receive.length === 2) {
        return `${desc.receive[0].amount} ${desc.receive[0].symbol} + ${desc.receive[1].amount} ${desc.receive[1].symbol}`;
      }
      return desc.receive[0]?.amount ?? "";
    }
    return "";
  }, [driving, state.amountText, quote, action, deployment]);

  const fromBalanceText = useMemo(
    () => getTokenBalanceText(state.fromSymbol, balances, deployment),
    [state.fromSymbol, balances, deployment]
  );
  const toBalanceText = useMemo(
    () => getTokenBalanceText(state.toSymbol, balances, deployment),
    [state.toSymbol, balances, deployment]
  );

  const fromPairBreakdown = useMemo((): [PairBreakdownItem, PairBreakdownItem] | undefined => {
    if (state.fromSymbol !== pairSymbol) return undefined;
    const stableBalance = getTokenBalanceText(neutronName, balances, deployment);
    const volatileBalance = getTokenBalanceText(protonName, balances, deployment);

    let stableAmount = "0";
    let volatileAmount = "0";

    if (quote.status === "ready" && quote.result?.ok && action === ACTION_TYPES.FUSION) {
      const desc = describeQuote(action, quote.result.quote, deployment);
      if (desc.pay.length === 2) {
        stableAmount = desc.pay[0].amount;
        volatileAmount = desc.pay[1].amount;
      }
    }

    return [
      { symbol: neutronName, balanceText: stableBalance, amountText: stableAmount },
      { symbol: protonName, balanceText: volatileBalance, amountText: volatileAmount },
    ];
  }, [state.fromSymbol, pairSymbol, neutronName, protonName, balances, deployment, quote, action]);

  const toPairBreakdown = useMemo((): [PairBreakdownItem, PairBreakdownItem] | undefined => {
    if (state.toSymbol !== pairSymbol) return undefined;
    const stableBalance = getTokenBalanceText(neutronName, balances, deployment);
    const volatileBalance = getTokenBalanceText(protonName, balances, deployment);

    let stableAmount = "0";
    let volatileAmount = "0";

    if (quote.status === "ready" && quote.result?.ok && action === ACTION_TYPES.FISSION) {
      const desc = describeQuote(action, quote.result.quote, deployment);
      if (desc.receive.length === 2) {
        stableAmount = desc.receive[0].amount;
        volatileAmount = desc.receive[1].amount;
      }
    }

    return [
      { symbol: neutronName, balanceText: stableBalance, amountText: stableAmount },
      { symbol: protonName, balanceText: volatileBalance, amountText: volatileAmount },
    ];
  }, [state.toSymbol, pairSymbol, neutronName, protonName, balances, deployment, quote, action]);

  // MAX button visibility rules:
  // Shown on FROM card for ERG (fission), proton, neutron; NEVER on pair token in FROM card.
  // Shown on TO card for ERG (fusion).
  const showFromMax = driving === "from" && state.fromSymbol !== pairSymbol && maxText !== undefined;
  const showToMax = driving === "to" && action === ACTION_TYPES.FUSION && maxText !== undefined;

  const handleFromMax = () => {
    if (maxText !== undefined) {
      dispatch({ type: "setAmount", amountText: maxText });
    }
  };

  const handleToMax = () => {
    if (maxText !== undefined) {
      dispatch({ type: "setAmount", amountText: maxText });
    }
  };

  const handleSwapClick = async () => {
    if (inFlightRef.current || inProgress) return;
    if (!listener || !action) return;

    inFlightRef.current = true;
    setInProgress(true);

    try {
      const utxos = await wallet.getUtxos();
      const freshBalances = sumBalances(utxos);
      const preState = toWalletState(freshBalances, deployment, Date.now());

      let result: SwapHandlerResult;

      if (action === ACTION_TYPES.FISSION) {
        const ergAmount = toBaseUnits(state.amountText, 9);
        result = await handleFissionSwap({
          client: swapClient,
          deployment,
          refresh,
          wallet,
          listener,
          preState,
          ergAmount,
        });
      } else if (action === ACTION_TYPES.FUSION) {
        const ergAmount = toBaseUnits(state.amountText, 9);
        result = await handleFusionSwap({
          client: swapClient,
          deployment,
          refresh,
          wallet,
          listener,
          preState,
          ergAmount,
        });
      } else if (action === ACTION_TYPES.TRANSMUTE_TO_PEG) {
        const amount = toBaseUnits(state.amountText, deployment.tokens.proton.decimals);
        result = await handleTransmutationSwap({
          client: swapClient,
          deployment,
          refresh,
          wallet,
          listener,
          preState,
          amount,
          direction: "to-peg",
        });
      } else if (action === ACTION_TYPES.TRANSMUTE_FROM_PEG) {
        const amount = toBaseUnits(state.amountText, deployment.tokens.neutron.decimals);
        result = await handleTransmutationSwap({
          client: swapClient,
          deployment,
          refresh,
          wallet,
          listener,
          preState,
          amount,
          direction: "from-peg",
        });
      } else {
        return;
      }

      if (result.txHash !== undefined) {
        dispatch({ type: "setAmount", amountText: "" });
        void balancesResult.refresh();
        refreshPending();
      }
    } catch (err: unknown) {
      console.error("Unexpected error in ReactorSwap handleSwapClick:", err);
    } finally {
      inFlightRef.current = false;
      setInProgress(false);
    }
  };

  const isInfoBanner =
    availability.banner?.code === "LOADING" ||
    availability.banner?.code === "NODE_ERROR" ||
    availability.banner?.code === "BOX_AMBIGUOUS";

  return (
    <div className={cn("flex w-full flex-col gap-6 xl:flex-row xl:items-start xl:justify-evenly", className)}>
      {/* Reactor Card column */}
      <div className="w-full xl:w-[580px]">
        {/* Availability Banner */}
        {availability.banner && (
          <div
            role="status"
            className={cn(
              "mb-4 rounded-xl border p-4 text-sm font-medium",
              isInfoBanner
                ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <p>{availability.banner.text}</p>
          </div>
        )}

        <Card className="rounded-2xl">
          <CardHeader className="space-y-1.5 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <h2 className="text-4xl font-bold">Reactor</h2>
                <p className="text-2xl font-semibold text-primary">{getTitle(action)}</p>
                <p className="text-sm text-muted-foreground">{getDescription(action, deployment)}</p>

                {/* Pending Transaction Banner */}
                {hasPending && (
                  <div className="space-y-1 pt-1">
                    <p className="animate-pulse text-sm text-blue-500">
                      Transaction pending…
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-0">
            {/* FROM Section */}
            <div className="space-y-2">
              <SwapTokenCard
                label="From"
                symbol={state.fromSymbol}
                tokens={allTokens}
                onSelectToken={(sym) => dispatch({ type: "selectFrom", symbol: sym, deployment })}
                value={fromCardValue}
                onChange={driving === "from" ? (val) => dispatch({ type: "setAmount", amountText: val }) : undefined}
                readOnly={driving !== "from"}
                disabled={isBlocked}
                decimals={fromDecimals}
                balanceText={fromBalanceText}
                onMax={showFromMax ? handleFromMax : undefined}
                error={driving === "from" ? buttonState.inlineError : undefined}
                pairBreakdown={fromPairBreakdown}
              />
            </div>

            {/* Reverse button between From and To */}
            <div className="relative -my-1 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => dispatch({ type: "reverse", deployment })}
                disabled={isBlocked || isReverseDisabled}
                className="rounded-full shadow-sm"
                aria-label="Reverse tokens"
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
            </div>

            {/* TO Section */}
            <div className="space-y-2">
              <SwapTokenCard
                label="To"
                symbol={state.toSymbol}
                tokens={validToTokens}
                onSelectToken={(sym) => dispatch({ type: "selectTo", symbol: sym, deployment })}
                value={toCardValue}
                onChange={driving === "to" ? (val) => dispatch({ type: "setAmount", amountText: val }) : undefined}
                readOnly={driving !== "to"}
                disabled={isBlocked}
                decimals={toDecimals}
                balanceText={toBalanceText}
                onMax={showToMax ? handleToMax : undefined}
                error={driving === "to" ? buttonState.inlineError : undefined}
                pairBreakdown={toPairBreakdown}
              />
            </div>

            {/* Swap Action Button */}
            <Button
              type="button"
              onClick={handleSwapClick}
              disabled={buttonState.disabled}
              className="mt-4 h-12 w-full text-base font-semibold"
            >
              {buttonState.label}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Receipt Column */}
      <SwapReceipt
        action={action ?? ACTION_TYPES.FISSION}
        quote={quote.status === "ready" && quote.result?.ok ? quote.result.quote : undefined}
        deployment={deployment}
      />
    </div>
  );
}
