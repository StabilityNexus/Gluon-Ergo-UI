/**
 * @file GluonExplainer.tsx
 * @description Collapsible "How does Gluon work?" panel explaining Fission, Fusion,
 * Transmutation, Reserve Ratio, and the v3 Healthy Range & Adjust Peg mechanism.
 * @module lib/components/blocks/dashboard
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGluon } from "@/lib/hooks/useGluon";

export function GluonExplainer() {
  const { deployment, presentation } = useGluon();
  const [isOpen, setIsOpen] = useState(false);

  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;
  const pegAsset = presentation.pegAsset;

  const sections = [
    {
      borderColor: "border-emerald-500/50",
      headingColor: "text-emerald-500 dark:text-emerald-400",
      label: "FISSION",
      body: `Deposit ERG into the Gluon reactor and split it into two tokens: ${neutronName} (tracks ${pegAsset} price) and ${protonName} (leveraged ERG exposure). A small fee is charged and added to the reserve.`,
    },
    {
      borderColor: "border-blue-500/50",
      headingColor: "text-blue-500 dark:text-blue-400",
      label: "FUSION",
      body: `Combine ${neutronName} and ${protonName} back into ERG. This is the reverse of fission. You get back ERG minus a small fee. Useful when you want to exit your position entirely.`,
    },
    {
      borderColor: "border-amber-500/50",
      headingColor: "text-amber-500 dark:text-amber-400",
      label: "TRANSMUTATION",
      body: `Swap between ${neutronName} and ${protonName} directly without going through ERG. The exchange rate is determined by the oracle price and fusion ratio. Fees apply and flow back into the reserve, increasing ${protonName} backing over time.`,
    },
    {
      borderColor: "border-border",
      headingColor: "text-muted-foreground",
      label: "RESERVE RATIO",
      body: `The reserve ratio is the total ERG in the reactor divided by the ERG value of all circulating ${neutronName}, showing how well ${neutronName} is collateralized. However, protocol health requires the fusion ratio q to stay within 50%–98%: even an overcollateralized reactor with q below 50% is outside the healthy range and trading pauses until Adjust Peg restores it.`,
    },
    {
      borderColor: "border-purple-500/50",
      headingColor: "text-purple-500 dark:text-purple-400",
      label: "HEALTHY RANGE & ADJUST PEG",
      body: `In Gluon v3, fission, fusion, and transmutations are only allowed while the fusion ratio q stays within the healthy range of 50% to 98%. If q moves outside this range, trading pauses and anyone can submit an Adjust Peg transaction to shift the peg factor by 1% per step until the reactor is healthy again.`,
    },
  ] as const;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <button
        id="gluon-explainer-toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-foreground">
          How does Gluon work?
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="select-none text-base leading-none text-muted-foreground"
          aria-hidden
        >
          &#9662;
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="explainer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-5 pt-1">
              {sections.map((s) => (
                <div
                  key={s.label}
                  className={`mb-4 border-l-2 pl-4 ${s.borderColor}`}
                >
                  <p className={`mb-1 text-xs font-semibold ${s.headingColor}`}>
                    {s.label}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
