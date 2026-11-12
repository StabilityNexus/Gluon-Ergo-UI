/**
 * @file TokenIcon.tsx
 * @description Pure presentational component rendering SVG token logos for Gluon assets.
 * @module lib/components/blockchain/swap
 */

import React from "react";
import { ErgIcon, NeutronIcon, ProtonIcon, NeutronProtonIcon } from "@/lib/components/icons";
import { tokenConfig } from "@/config/tokenConfig";
import { cn } from "@/lib/utils/utils";

export interface TokenIconProps {
  symbol: string;
  className?: string;
}

export function TokenIcon({ symbol, className = "h-6 w-6" }: TokenIconProps) {
  const stableSymbol = tokenConfig.stableAsset.symbol;
  const volatileSymbol = tokenConfig.volatileAsset.symbol;
  const pairSymbol = tokenConfig.pairToken.symbol;

  switch (symbol) {
    case "ERG":
      return <ErgIcon className={cn("text-blue-500 flex-shrink-0", className)} />;
    case stableSymbol:
    case "GAU":
      return <NeutronIcon className={cn("flex-shrink-0", className)} />;
    case volatileSymbol:
    case "GAUC":
      return <ProtonIcon className={cn("flex-shrink-0", className)} />;
    case pairSymbol:
    case "GAU-GAUC":
      return <NeutronProtonIcon className={cn("flex-shrink-0", className)} />;
    default:
      return null;
  }
}
