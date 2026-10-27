/**
 * @file useGluon.ts
 * @description Hook to consume Gluon protocol context.
 * @module lib/hooks
 */
import { useContext } from "react";
import { GluonContext, type GluonContextValue } from "@/lib/providers/GluonProvider";

export function useGluon(): GluonContextValue {
  const context = useContext(GluonContext);
  if (!context) {
    throw new Error("useGluon must be used within a GluonProvider");
  }
  return context;
}
