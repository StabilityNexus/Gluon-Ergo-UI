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

    if (!sessionId || !operationType || !toAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const isFusionOperation = operationType === "fusion";

    if (!isFusionOperation && !fromAmount) {
      return res.status(400).json({ error: "Missing fromAmount" });
    }

    if (isFusionOperation && (!gauAmount || !gaucAmount)) {
      return res.status(400).json({ error: "Missing GAU/GAUC amounts for fusion" });
    }

    const validOperations = ["fission", "fusion", "transmute-to-gold", "transmute-from-gold"];
    if (!validOperations.includes(operationType)) {
      return res.status(400).json({ error: "Invalid operation type" });
    }

    storeSession({
      sessionId,
      operationType,
      fromAmount: fromAmount || "0",
      toAmount,
      gauAmount: gauAmount || "0",
      gaucAmount: gaucAmount || "0",
      fromToken,
      toToken,
      fees,
    });


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
