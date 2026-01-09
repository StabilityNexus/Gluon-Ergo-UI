import type { NextApiRequest, NextApiResponse } from "next";
import type { ErgoPaySigningRequest } from "@/lib/ergopay/types";

const sessionMap = new Map<string, string>();

export default function handler(req: NextApiRequest, res: NextApiResponse<ErgoPaySigningRequest>) {
  if (req.method !== "GET") {
    return res.status(405).json({
      message: "Method not allowed",
      messageSeverity: "ERROR",
    });
  }

  const { sessionId, address } = req.query;

  if (!sessionId || !address || typeof sessionId !== "string" || typeof address !== "string") {
    return res.status(400).json({
      message: "Invalid session or address format",
      messageSeverity: "ERROR",
    });
  }

  sessionMap.set(sessionId, address);

  res.status(200).json({
    message: "Wallet address captured successfully! You can now return to the dApp.",
    messageSeverity: "INFORMATION",
    address: address,
  });
}

export { sessionMap };
