/**
 * @file SwapTokenCard.tsx
 * @description Pure controlled token card input component with balance display, MAX trigger, and sanitized numerical input.
 * @module lib/components/blockchain/swap
 */

import React, { useId } from "react";
import { Button } from "@/lib/components/ui/button";
import { sanitizeAmountInput } from "@/lib/functions/reactor/swapModel";
import { cn } from "@/lib/utils/utils";

export interface SwapTokenCardProps {
  label: string;
  symbol: string;
  balanceText?: string;
  value: string;
  onChange?: (val: string) => void;
  onMax?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  decimals: number;
  error?: string;
  className?: string;
}

/**
 * Pure controlled token input card.
 *
 * Enforces decimal precision and valid characters via sanitizeAmountInput.
 * Displays token symbol, balanceText, optional MAX action, and role="alert" error messages.
 */
export function SwapTokenCard({
  label,
  symbol,
  balanceText,
  value,
  onChange,
  onMax,
  disabled = false,
  readOnly = false,
  decimals,
  error,
  className,
}: SwapTokenCardProps) {
  const inputId = useId();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return;
    const raw = e.target.value;
    const sanitized = sanitizeAmountInput(raw, decimals);
    if (sanitized !== null) {
      onChange(sanitized);
    }
  };

  return (
    <div
      className={cn(
        "w-full rounded-xl bg-gradient-to-r from-foreground/10 to-muted-foreground/5 p-4 dark:from-white/10 dark:to-white/5",
        className
      )}
    >
      {/* Header row: Label and Balance */}
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <span className="text-sm text-muted-foreground">
          Balance: {balanceText ?? "—"}
        </span>
      </div>

      {/* Main row: Symbol pill, Input, and optional MAX button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Token symbol display */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-muted px-3 py-2 font-semibold text-foreground shadow-sm">
            <span>{symbol}</span>
          </div>
          {onMax && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMax}
              disabled={disabled}
              className="h-8 px-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              MAX
            </Button>
          )}
        </div>

        {/* Input */}
        <div className="flex flex-1 items-center justify-end">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            readOnly={readOnly}
            placeholder="0"
            className={cn(
              "w-full min-w-[80px] border-0 bg-transparent text-left text-2xl font-bold focus:outline-none sm:text-right sm:text-3xl",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "text-foreground placeholder:text-muted-foreground"
            )}
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

