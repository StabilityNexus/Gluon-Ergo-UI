/**
 * @file NetworkGuard.tsx
 * @description Blocking alert banner rendered when the connected wallet is not on Ergo mainnet.
 * @module lib/components/blockchain/reactor
 */

import React from "react";
import type { NetworkGuardStatus } from "@/lib/hooks/useNetworkGuard";
import { cn } from "@/lib/utils/utils";

export interface NetworkGuardProps {
  status: NetworkGuardStatus;
  className?: string;
}

/**
 * Renders nothing for "unknown" and "mainnet" (identical wrapper-less output on server and client),
 * and renders a blocking alert banner when status is "wrong-network".
 */
export function NetworkGuard({ status, className }: NetworkGuardProps) {
  if (status !== "wrong-network") {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-400",
        className
      )}
    >
      <p>Your wallet is not connected to Ergo mainnet. Switch it to mainnet.</p>
    </div>
  );
}

