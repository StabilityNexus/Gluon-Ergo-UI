/**
 * @file ReactorHealth.tsx
 * @description Props-only reactor health card showing fusion ratio q, healthy band, peg drift, oracle age, and ERG prices.
 * @module lib/components/blockchain/reactor
 */

import React from "react";
import type { GluonDeployment, ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";
import {
  bandPosition,
  describePegTarget,
  formatDriftPercent,
  formatErgPrice,
  formatQPercent,
} from "@/lib/functions/reactor/health";
import { Card, CardContent } from "@/lib/components/ui/card";
import { Separator } from "@/lib/components/ui/separator";
import { cn } from "@/lib/utils/utils";

export interface ReactorHealthProps {
  snapshot?: ProtocolSnapshot;
  deployment: GluonDeployment;
  className?: string;
}

/**
 * Presentational reactor health card displaying:
 * - Fusion ratio q percentage bar with 50%–98% healthy band markers
 * - Healthy vs. outside healthy range status
 * - Peg factor percentage of initial and oracle price age in blocks
 * - "Prices and the peg" lines (target, peg unit oracle price, neutron and proton market prices) in ERG
 *
 * Reusable across swap and dashboard pages (props-only, hydration-safe).
 */
export function ReactorHealth({ snapshot, deployment, className }: ReactorHealthProps) {
  return (
    <div className={cn("w-full", className)}>
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          {!snapshot ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <p className="text-sm">Loading reactor data…</p>
            </div>
          ) : (
            (() => {
              const band = bandPosition(snapshot.q);
              const qPercentText = formatQPercent(snapshot.q);
              const driftPercentText = formatDriftPercent(
                snapshot.pegFactor,
                snapshot.initialPegFactor
              );
              const targetDescription = describePegTarget(snapshot, deployment);
              const statusLabel = snapshot.healthy ? "Healthy" : "Outside the healthy range";

              // Clamp and marker positions are computed in bigint math by bandPosition;
              // convert to JS numbers ONLY at the final CSS style values.
              const fillWidthPercent = Number(band.percent);
              const minMarkerPercent = Number(band.minPercent);
              const maxMarkerPercent = Number(band.maxPercent);
              const bandWidthPercent = maxMarkerPercent - minMarkerPercent;

              return (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Reactor health</h3>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        snapshot.healthy
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Fusion ratio q bar */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Fusion ratio q</span>
                      <span className="font-semibold text-foreground">{qPercentText} %</span>
                    </div>

                    <div
                      role="img"
                      aria-label={`Fusion ratio q is ${qPercentText}%, healthy band ${minMarkerPercent}% to ${maxMarkerPercent}%, status ${statusLabel}`}
                      className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
                    >
                      {/* Healthy band (50% - 98%) */}
                      <div
                        className="absolute inset-y-0 bg-emerald-500/20"
                        style={{
                          left: `${minMarkerPercent}%`,
                          width: `${bandWidthPercent}%`,
                        }}
                      />

                      {/* Fill at q */}
                      <div
                        className={cn(
                          "relative h-full rounded-full transition-all",
                          snapshot.healthy ? "bg-emerald-500" : "bg-amber-500"
                        )}
                        style={{ width: `${fillWidthPercent}%` }}
                      />

                      {/* 50% and 98% boundary markers */}
                      <div
                        className="absolute inset-y-0 w-0.5 bg-foreground/60"
                        style={{ left: `${minMarkerPercent}%` }}
                      />
                      <div
                        className="absolute inset-y-0 w-0.5 bg-foreground/60"
                        style={{ left: `${maxMarkerPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>0 %</span>
                      <span>
                        Healthy band: {minMarkerPercent} % – {maxMarkerPercent} %
                      </span>
                      <span>100 %</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>peg factor {driftPercentText} % of initial</span>
                    <span>oracle price age: {snapshot.oracleAge} blocks</span>
                  </div>

                  <Separator />

                  {/* Prices and the peg */}
                  <div className="space-y-2 text-sm">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prices and the peg
                    </h4>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{targetDescription.text}</span>
                      <span className="shrink-0 font-semibold text-foreground">
                        {formatErgPrice(snapshot.targetPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Oracle price ({deployment.peg})
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        {formatErgPrice(snapshot.pegUnitPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {deployment.tokens.neutron.name} market price
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        {formatErgPrice(snapshot.neutronPrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {deployment.tokens.proton.name} market price
                      </span>
                      <span className="shrink-0 font-medium text-foreground">
                        {formatErgPrice(snapshot.protonPrice)}
                      </span>
                    </div>
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

