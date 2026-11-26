/**
 * @file AdjustPegPanel.tsx
 * @description Reactor peg adjustment card providing multi-step guidance, cost calculations, and network interaction.
 * @module lib/components/blockchain/reactor
 */

import React from "react";
import { useGluon } from "@/lib/hooks/useGluon";
import { useAdjustPeg } from "@/lib/hooks/useAdjustPeg";
import { formatUnits } from "@/lib/utils/amounts";
import { Card } from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";
import { cn } from "@/lib/utils/utils";

export interface AdjustPegPanelProps {
  networkBlocked?: boolean;
  minerFee?: bigint;
  className?: string;
  pollMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * AdjustPegPanel displays peg adjustment guidance when the reactor is unhealthy.
 *
 * Shows the required direction (lowered/raised), needed step count, miner fee cost,
 * and button to submit or recheck steps sequentially.
 *
 * When not visible and no message exists, renders null.
 * When not visible but an info/error message exists (e.g. "The reactor is healthy again..."),
 * renders only the message within a Card container.
 *
 * @param props - Presentation and polling configuration.
 * @returns Card component or null.
 */
export function AdjustPegPanel({
  networkBlocked,
  minerFee: minerFeeProp,
  className,
  pollMs,
  timeoutMs,
  sleep,
  now,
}: AdjustPegPanelProps) {
  const { client } = useGluon();
  const { state, directionText, remainingSteps, message, run } = useAdjustPeg({
    networkBlocked,
    pollMs,
    timeoutMs,
    sleep,
    now,
  });

  const effectiveMinerFee = minerFeeProp ?? client?.minerFee;

  // Render nothing if not visible and no message to display
  if (!state.visible && !message) {
    return null;
  }

  // When panel form is not visible but a message exists, render only the message region
  if (!state.visible && message) {
    return (
      <Card className={cn("p-6", className)}>
        <div
          role={message.kind === "error" ? "alert" : "status"}
          aria-live={message.kind === "error" ? "assertive" : "polite"}
          className={cn(
            "text-sm font-medium",
            message.kind === "error" ? "text-destructive" : "text-green-600 dark:text-green-400"
          )}
        >
          {message.text}
        </div>
      </Card>
    );
  }

  const stepsLabel = `${remainingSteps} ${remainingSteps === 1 ? "step" : "steps"} needed at the current price.`;
  const costAbout =
    effectiveMinerFee !== undefined
      ? ` About ${formatUnits(effectiveMinerFee * BigInt(remainingSteps), 9)} ERG for ${remainingSteps} ${remainingSteps === 1 ? "step" : "steps"}.`
      : "";

  return (
    <Card className={cn("p-6 space-y-4", className)}>
      <h3 className="text-lg font-semibold text-foreground">Adjust peg</h3>
      <p className="text-sm text-muted-foreground">
        The reactor is outside its healthy range. Anyone can bring it back by moving the peg factor 1 % per step.
      </p>
      <p className="text-sm text-foreground">
        The peg factor will be {directionText}.
      </p>
      <p className="text-sm text-foreground">
        {stepsLabel}
      </p>
      <p className="text-xs text-muted-foreground">
        Cost: one miner fee per step, paid by you; no protocol fee.{costAbout}
      </p>

      {message && (
        <div
          role={message.kind === "error" ? "alert" : "status"}
          aria-live={message.kind === "error" ? "assertive" : "polite"}
          className={cn(
            "text-sm font-medium",
            message.kind === "error" ? "text-destructive" : "text-green-600 dark:text-green-400"
          )}
        >
          {message.text}
        </div>
      )}

      <Button
        type="button"
        disabled={state.disabled}
        onClick={() => {
          void run();
        }}
        className="w-full"
      >
        {state.label}
      </Button>
    </Card>
  );
}
