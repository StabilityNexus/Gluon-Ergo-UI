import type { NextApiRequest, NextApiResponse } from "next";
import { storeSession } from "@/lib/utils/session-manager";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      sessionId,
      operationType,
      fromAmount,
      toAmount,
      gauAmount,
      gaucAmount,
      fromToken,
      toToken,
      fees,
    } = req.body;

    // Validate required fields with type checking
    if (!sessionId || typeof sessionId !== "string" || 
        !operationType || typeof operationType !== "string" || 
        !toAmount || typeof toAmount !== "string") {
      return res.status(400).json({ error: "Missing or invalid required fields" });
    }

    const isFusionOperation = operationType === "fusion";

    if (!isFusionOperation && !fromAmount) {
      return res.status(400).json({ error: "Missing fromAmount" });
    }

    // Validate fromAmount type when present
    if (fromAmount && typeof fromAmount !== "string") {
      return res.status(400).json({ error: "Invalid fromAmount type" });
    }

    if (isFusionOperation && (!gauAmount || !gaucAmount)) {
      return res.status(400).json({ error: "Missing GAU/GAUC amounts for fusion" });
    }

    // Validate GAU/GAUC types for fusion
    if (isFusionOperation && (typeof gauAmount !== "string" || typeof gaucAmount !== "string")) {
      return res.status(400).json({ error: "Invalid GAU/GAUC amount types" });
    }

    const validOperations = ["fission", "fusion", "transmute-to-gold", "transmute-from-gold"] as const;
    if (!validOperations.includes(operationType as any)) {
      return res.status(400).json({ error: "Invalid operation type" });
    }

    // Validate and normalize amount fields
    const normalizeAmount = (amount: string | undefined, fieldName: string, isRequired: boolean): string => {
      if (!amount) {
        if (isRequired) {
          throw new Error(`${fieldName} is required`);
        }
        return "0";
      }

      // Trim whitespace and remove thousands separators (commas)
      const normalized = amount.trim().replace(/,/g, "");

      // Validate it's a valid number
      const parsed = parseFloat(normalized);
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid ${fieldName}: must be a non-negative number`);
      }

      return normalized;
    };

    // Validate and normalize amounts based on operation type
    try {
      const normalizedToAmount = normalizeAmount(toAmount, "toAmount", true);
      const normalizedFromAmount = isFusionOperation 
        ? "0" 
        : normalizeAmount(fromAmount, "fromAmount", true);
      const normalizedGauAmount = isFusionOperation 
        ? normalizeAmount(gauAmount, "gauAmount", true) 
        : "0";
      const normalizedGaucAmount = isFusionOperation 
        ? normalizeAmount(gaucAmount, "gaucAmount", true) 
        : "0";

      storeSession({
        sessionId,
        operationType: operationType as "fission" | "fusion" | "transmute-to-gold" | "transmute-from-gold",
        fromAmount: normalizedFromAmount,
        toAmount: normalizedToAmount,
        gauAmount: normalizedGauAmount,
        gaucAmount: normalizedGaucAmount,
        fromToken,
        toToken,
        fees,
      });
    } catch (validationError: any) {
      return res.status(400).json({ error: validationError.message });
    }


    return res.status(200).json({ 
      success: true,
      sessionId,
      operationType 
    });
  } catch (error) {
    console.error("Error storing session:", error);
    return res.status(500).json({ error: "Failed to store session" });
  }
}
