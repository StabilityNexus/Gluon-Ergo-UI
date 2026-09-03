/**
 * @file FeeBreakdownPanel.tsx
 * @description Pre-transaction fee preview panel for the transmutation flow.
 * Debounces SDK calls at 400ms, slides in with framer-motion AnimatePresence.
 * No Lottie. Minimal DeFi-style card matching the design system.
 * @module frontend/components/blockchain/swap
 */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FeeBreakdownPanelProps {
  amountERG: number;
  direction: "toNeutron" | "toProton";
  ergPriceUSD: number;
  currentReserveRatio: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface BreakdownData {
  feeAmountERG: number;
  feeAmountUSD: number;
  netOutput: number | null;
  priceImpact: number;
  newReserveRatio: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function impactColor(pct: number): string {
  if (Math.abs(pct) < 0.5) return "#10b981"; // emerald
  if (Math.abs(pct) < 1.0) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function ratioColor(ratio: number): string {
  if (ratio >= 400) return "#10b981";
  if (ratio >= 200) return "#f59e0b";
  return "#ef4444";
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
      <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeeBreakdownPanel({
  amountERG,
  direction,
  ergPriceUSD,
  currentReserveRatio,
}: FeeBreakdownPanelProps) {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!amountERG || amountERG <= 0) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const sdk = await import("gluon-ergo-sdk");
        const gluon = new sdk.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        gluon.config.NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || "https://node.ergopool.io/";

        const gluonBox = await gluon.getGluonBox();
        const amountNano = Math.round(amountERG * 1e9);

        const [oracleBox, currentHeight] = await Promise.all([
          gluon.getOracleBox(),
          fetch(
            `${process.env.NEXT_PUBLIC_NODE || "https://node.sigmaspace.io"}/blocks/lastHeaders/1`
          )
            .then((r) => r.json())
            .then((h: Array<{ height: number }>) => h[0]?.height ?? 0)
            .catch(() => 0),
        ]);

        if (cancelled) return;

        const [fees, outputRaw] = await Promise.all([
          direction === "toNeutron"
            ? gluon.getTotalFeeAmountTransmuteToNeutron(gluonBox, oracleBox, amountNano)
            : gluon.getTotalFeeAmountTransmuteToProton(gluonBox, oracleBox, amountNano),
          direction === "toNeutron"
            ? gluon.transmuteToNeutronWillGet(gluonBox, oracleBox, amountNano, currentHeight)
            : gluon.transmuteToProtonWillGet(gluonBox, oracleBox, amountNano, currentHeight),
        ]);

        if (cancelled) return;

        const feeNano: number =
          typeof fees === "object" && fees !== null && "totalFee" in fees
            ? Number((fees as { totalFee: bigint | number }).totalFee)
            : Number(fees);

        const feeERG = feeNano / 1e9;
        const netOutputRaw = Number(outputRaw) / 1e9;
        const netOutput = netOutputRaw < 0 ? null : netOutputRaw;
        const priceImpact = amountERG > 0 ? (feeERG / amountERG) * 100 : 0;
        const newReserveRatio = Math.max(
          0,
          currentReserveRatio - (feeERG / amountERG) * currentReserveRatio * 0.01
        );

        if (!cancelled) {
          setData({
            feeAmountERG: feeERG,
            feeAmountUSD: feeERG * ergPriceUSD,
            netOutput,
            priceImpact,
            newReserveRatio,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[FeeBreakdownPanel]", err);
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amountERG, direction, ergPriceUSD, currentReserveRatio]);

  return (
    <AnimatePresence>
      {amountERG > 0 && (
        <motion.div
          key="fee-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div
            className="mt-2 rounded-xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#141414] p-4"
            aria-label="Transaction Preview"
          >
            {/* Heading */}
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-white/40">
              Transaction Preview
            </p>

            {/* Rows */}
            {loading ? (
              <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : data ? (
              <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {(() => {
                  const safeWillGet = (data.netOutput !== null && data.netOutput < 0) ? null : data.netOutput;
                  return (
                    <>
                      {/* Fee Amount */}
                <li className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-white/50">Fee Amount</span>
                  <span>
                    <span className="text-sm font-semibold text-amber-400">
                      {data.feeAmountERG.toFixed(4)} ERG
                    </span>
                    {data.feeAmountUSD > 0 && (
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-white/30">
                        (${data.feeAmountUSD.toFixed(2)})
                      </span>
                    )}
                  </span>
                </li>

                {/* You Will Receive */}
                <li className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-white/50">You Will Receive</span>
                  {safeWillGet === null ? (
                    <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                      Restricted — reserve ratio too low
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {safeWillGet.toFixed(4)} {direction === 'toNeutron' ? 'GAU' : 'GAUC'}
                    </span>
                  )}
                </li>

                {/* Price Impact */}
                <li className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-white/50">Price Impact</span>
                  {safeWillGet === null ? (
                    <span className="text-sm font-semibold text-gray-400 dark:text-white/40">—</span>
                  ) : (
                    <span
                      className="text-sm font-semibold"
                      style={{ color: impactColor(data.priceImpact) }}
                    >
                      {data.priceImpact.toFixed(2)}%
                    </span>
                  )}
                </li>

                {/* Reserve Ratio After */}
                <li className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-white/50">Reserve Ratio After</span>
                  <span className="text-sm font-semibold">
                    <span className="text-gray-400 dark:text-white/40 text-xs">
                      {currentReserveRatio.toFixed(1)}%
                    </span>
                    <span className="mx-1.5 text-gray-400 dark:text-white/30 text-xs">→</span>
                    <span style={{ color: ratioColor(data.newReserveRatio) }}>
                      {data.newReserveRatio.toFixed(1)}%
                    </span>
                  </span>
                </li>
              </>
            );
          })()}
        </ul>
      ) : (
              <p className="py-2 text-xs text-gray-400 dark:text-white/30">Unable to estimate fees.</p>
            )}

            {/* Footer */}
            <div className="mt-3 border-t border-gray-100 dark:border-white/[0.05] pt-3">
              <p className="text-xs text-gray-400 dark:text-white/30">
                Estimates update every 400ms · Actual amounts may vary slightly
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
