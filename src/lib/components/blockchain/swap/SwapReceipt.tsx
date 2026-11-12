/**
 * @file SwapReceipt.tsx
 * @description Pure presentational component showing transaction pay, receive, and fee summary.
 * @module lib/components/blockchain/swap
 */

import React from "react";
import type { ActionQuote, GluonDeployment } from "@stability-nexus/gluon-ergo-sdk";
import type { ActionType } from "@/lib/constants/token";
import { describeQuote } from "@/lib/functions/reactor/describeQuote";
import { FeeBreakdownPanel } from "./FeeBreakdownPanel";
import { Card, CardContent } from "@/lib/components/ui/card";
import { Separator } from "@/lib/components/ui/separator";
import { cn } from "@/lib/utils/utils";

export interface SwapReceiptProps {
  action: ActionType;
  quote?: ActionQuote;
  deployment: GluonDeployment;
  className?: string;
}

/**
 * Presentational swap receipt component displaying:
 * - "You pay" block with tokens and amounts
 * - FeeBreakdownPanel with exact protocol fees
 * - "You will receive" block with output tokens
 * - Neutral empty placeholder when quote is undefined
 *
 * Fully hydration-safe: responsive breakpoints handled via Tailwind classes (xl:w-[260px]).
 */
export function SwapReceipt({ action, quote, deployment, className }: SwapReceiptProps) {
  return (
    <div className={cn("w-full xl:w-[260px]", className)}>
      <Card className="rounded-2xl">
        <CardContent className="p-6 xl:p-4">
          {!quote ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <p className="text-sm xl:text-xs">
                Enter an amount to preview transaction receipt and fees.
              </p>
            </div>
          ) : (
            (() => {
              const { pay, receive } = describeQuote(action, quote, deployment);

              return (
                <div className="space-y-3 text-sm xl:space-y-2 xl:text-xs">
                  {/* You pay block */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      You pay
                    </span>
                    {pay.map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{item.symbol}</span>
                        <span className="font-semibold text-foreground">
                          {item.amount} {item.symbol}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-2 xl:my-1 xl:opacity-50" />

                  {/* Fee breakdown panel */}
                  <FeeBreakdownPanel fees={quote.fees} />

                  <Separator className="my-2 xl:my-1 xl:opacity-50" />

                  {/* You will receive block */}
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      You will receive
                    </span>
                    {receive.map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{item.symbol}</span>
                        <span className="font-semibold text-foreground">
                          {item.amount} {item.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}

