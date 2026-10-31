/**
 * @file useTransactionListener.ts
 * @description Hook managing TransactionListener lifecycle, background status checks, and wallet reconciliation.
 * @module lib/hooks
 */

import { useState, useEffect, useRef } from "react";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { NodeService } from "@/lib/utils/node-service";
import {
  createTransactionListener as defaultCreateTransactionListener,
  type TransactionListener,
} from "@/lib/utils/transaction-listener";
import { sumBalances, toBalanceList } from "@/lib/functions/reactor/balances";
import { env } from "@/config/env";

export interface UseTransactionListenerOptions {
  /**
   * Node REST endpoint URL. Defaults to env.nodeUrl.
   */
  nodeUrl?: string;
  /**
   * Factory creating a TransactionListener instance. Injectable for testing without network.
   */
  createListener?: (nodeService: NodeService) => TransactionListener;
  /**
   * Periodic check interval in milliseconds.
   * Default: 20000 (interval value taken from the earlier report).
   */
  checkIntervalMs?: number;
}

export interface UseTransactionListenerResult {
  listener: TransactionListener | undefined;
  hasPending: boolean;
  refreshPending: () => void;
}

/**
 * Hook to lazily create and manage a TransactionListener instance.
 *
 * Strict SSR compliance: No instances or listeners are created during initial render
 * or at module evaluation scope. Creation occurs purely inside an effect when connected.
 *
 * @param options Configuration for node endpoint, listener factory, and check polling interval.
 * @returns {UseTransactionListenerResult} The active listener (or undefined) and whether pending transactions exist.
 */
export function useTransactionListener(options?: UseTransactionListenerOptions): UseTransactionListenerResult {
  const { isConnected, isRestoringConnection, getUtxos } = useErgo();

  const nodeUrl = options?.nodeUrl ?? env.nodeUrl;
  const createListener = options?.createListener ?? defaultCreateTransactionListener;
  const checkIntervalMs = options?.checkIntervalMs ?? 20000;

  const [listener, setListener] = useState<TransactionListener | undefined>(undefined);
  const [hasPending, setHasPending] = useState<boolean>(false);

  // Keep a stable ref to getUtxos so background intervals always call the latest function
  const getUtxosRef = useRef(getUtxos);
  useEffect(() => {
    getUtxosRef.current = getUtxos;
  }, [getUtxos]);

  const isAvailable = isConnected && !isRestoringConnection;
  const listenerRef = useRef<TransactionListener | undefined>(undefined);

  useEffect(() => {
    if (!isAvailable) {
      listenerRef.current = undefined;
      return;
    }

    // Lazy initialization strictly in effect (safe for SSR / static export)
    const nodeService = new NodeService(nodeUrl);
    const instance = createListener(nodeService);
    listenerRef.current = instance;

    const balanceProvider = async (): Promise<Array<{ tokenId: string; balance: string }>> => {
      const boxes = await getUtxosRef.current();
      const summed = sumBalances(boxes);
      return toBalanceList(summed);
    };

    instance.setBalanceProvider(balanceProvider);
    instance.initialize();

    queueMicrotask(() => {
      setListener(instance);
      setHasPending(instance.hasPendingTransactions());
    });

    const performCheck = async (): Promise<void> => {
      try {
        await instance.checkWalletUpdates(balanceProvider);
        setHasPending(instance.hasPendingTransactions());
      } catch (err: unknown) {
        console.error("Error during transaction update check:", err);
      }
    };

    const intervalId = setInterval(() => {
      void performCheck();
    }, checkIntervalMs);

    return () => {
      listenerRef.current = undefined;
      clearInterval(intervalId);
    };
  }, [isAvailable, nodeUrl, createListener, checkIntervalMs]);

  const refreshPending = (): void => {
    const current = isAvailable ? (listenerRef.current ?? listener) : undefined;
    if (current) {
      setHasPending(current.hasPendingTransactions());
    }
  };

  return {
    listener: isAvailable ? listener : undefined,
    hasPending: isAvailable ? hasPending : false,
    refreshPending,
  };
}
