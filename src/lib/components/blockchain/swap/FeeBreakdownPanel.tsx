/**
 * @file FeeBreakdownPanel.tsx
 * @description Pure presentational component rendering the transaction fee breakdown.
 * @module lib/components/blockchain/swap
 */

import React from "react";
import type { ActionQuote } from "@stability-nexus/gluon-ergo-sdk";
import { formatUnits } from "@/lib/utils/amounts";
import { Separator } from "@/lib/components/ui/separator";
import { cn } from "@/lib/utils/utils";

export interface FeeBreakdownPanelProps {
  fees: ActionQuote["fees"];
  className?: string;
}

/**
 * Renders Dev fee, Oracle fee, Fee output boxes (outputsMinFee), Miner fee,
 * and Total fees formatted as ERG using formatUnits.
 *
 * Fully presentational and hydration-safe: reads only props.
 */
export function FeeBreakdownPanel({ fees, className }: FeeBreakdownPanelProps) {
  const ergDecimals = 9;

  return (
    <div className={cn("space-y-2 text-sm xl:space-y-1.5 xl:text-xs", className)}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground xl:text-xs">Dev fee</span>
        <span className="font-medium text-foreground">
          {formatUnits(fees.dev, ergDecimals)} ERG
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground xl:text-xs">Oracle fee</span>
        <span className="font-medium text-foreground">
          {formatUnits(fees.oracle, ergDecimals)} ERG
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground xl:text-xs">Fee output boxes</span>
        <span className="font-medium text-foreground">
          {formatUnits(fees.outputsMinFee, ergDecimals)} ERG
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground xl:text-xs">Miner fee</span>
        <span className="font-medium text-foreground">
          {formatUnits(fees.miner, ergDecimals)} ERG
        </span>
      </div>

      <Separator className="my-2 xl:my-1.5 xl:opacity-70" />

      <div className="flex items-center justify-between font-semibold">
        <span className="text-foreground">Total fees</span>
        <span className="text-foreground">
          {formatUnits(fees.total, ergDecimals)} ERG
        </span>
      </div>
    </div>
  );
}

