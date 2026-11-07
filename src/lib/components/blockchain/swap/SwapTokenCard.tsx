/**
 * @file SwapTokenCard.tsx
 * @description Pure controlled token card input component with embedded Radix Select token dropdown, balance display, MAX trigger, sanitized numerical input, and dual pair breakdown support.
 * @module lib/components/blockchain/swap
 */

import React, { useId } from "react";
import { Button } from "@/lib/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/components/ui/select";
import { sanitizeAmountInput } from "@/lib/functions/reactor/swapModel";
import { TokenIcon } from "./TokenIcon";
import { cn } from "@/lib/utils/utils";

export interface TokenOption {
  symbol: string;
  name?: string;
}

export interface PairBreakdownItem {
  symbol: string;
  balanceText?: string;
  amountText: string;
}

export interface SwapTokenCardProps {
  label: string;
  symbol: string;
  tokens?: TokenOption[];
  onSelectToken?: (symbol: string) => void;
  balanceText?: string;
  value: string;
  onChange?: (val: string) => void;
  onMax?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  decimals: number;
  error?: string;
  className?: string;
  pairBreakdown?: [PairBreakdownItem, PairBreakdownItem];
}

/**
 * Pure controlled token input card.
 *
 * Enforces decimal precision and valid characters via sanitizeAmountInput.
 * Displays embedded token dropdown selector with SVG logos, balanceText, optional MAX action,
 * and role="alert" error messages. Supports dual pair breakdown for combined tokens.
 */
export function SwapTokenCard({
  label,
  symbol,
  tokens,
  onSelectToken,
  balanceText,
  value,
  onChange,
  onMax,
  disabled = false,
  readOnly = false,
  decimals,
  error,
  className,
  pairBreakdown,
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

  const hasDropdown = tokens && onSelectToken && tokens.length > 0;

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

      {/* Main row: Token Selector, optional MAX button, and Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Token selector pill / dropdown */}
        <div className="flex items-center gap-2">
          {hasDropdown ? (
            <Select value={symbol} onValueChange={onSelectToken} disabled={disabled}>
              <SelectTrigger
                aria-label={`${label} token`}
                className="h-10 w-full min-w-[130px] sm:min-w-[160px] max-w-[200px] border-border bg-muted px-3 py-2 font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/80 focus:ring-1 focus:ring-ring"
              >
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <TokenIcon symbol={symbol} className="h-6 w-6" />
                    <span className="font-semibold">{symbol}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border border-border bg-background shadow-lg">
                {tokens.map((token) => (
                  <SelectItem
                    key={token.symbol}
                    value={token.symbol}
                    className="cursor-pointer font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={token.symbol} className="h-6 w-6" />
                      <span>{token.symbol}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 font-semibold text-foreground shadow-sm">
              <TokenIcon symbol={symbol} className="h-6 w-6" />
              <span>{symbol}</span>
            </div>
          )}

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

      {/* Pair breakdown (dual boxes for combined tokens like GAU-GAUC) */}
      {pairBreakdown && (
        <div className="mt-3 grid grid-cols-1 gap-3 pt-2 border-t border-border/40">
          {/* Item 0 (Stable asset) */}
          <div className="space-y-1.5">
            <div className="flex justify-between px-1 text-xs text-muted-foreground">
              <span>{pairBreakdown[0].symbol} Balance</span>
              <span>{pairBreakdown[0].balanceText ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 shadow-inner">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                <TokenIcon symbol={pairBreakdown[0].symbol} className="h-7 w-7" />
              </div>
              <span className="flex-1 text-xl font-bold sm:text-2xl text-foreground">
                {pairBreakdown[0].amountText || "0"}
              </span>
            </div>
          </div>

          {/* Item 1 (Volatile asset) */}
          <div className="space-y-1.5">
            <div className="flex justify-between px-1 text-xs text-muted-foreground">
              <span>{pairBreakdown[1].symbol} Balance</span>
              <span>{pairBreakdown[1].balanceText ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 shadow-inner">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                <TokenIcon symbol={pairBreakdown[1].symbol} className="h-7 w-7" />
              </div>
              <span className="flex-1 text-xl font-bold sm:text-2xl text-foreground">
                {pairBreakdown[1].amountText || "0"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
