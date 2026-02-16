import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, updateSessionStatus } from "@/lib/utils/session-manager";
import { handleTransmuteToGoldSwapErgoPay } from "@/lib/functions/reactor/handleTransmutation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ 
      message: "Method not allowed",
      messageSeverity: "ERROR" 
    });
  }

  const { sessionId, address } = req.query;

  if (!sessionId || typeof sessionId !== "string" || !address || typeof address !== "string") {
    return res.status(400).json({ 
      message: "Missing sessionId or address",
      messageSeverity: "ERROR" 
    });
  }

  try {
    const session = getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        message: "Session not found or expired",
        messageSeverity: "ERROR" 
      });
    }


    const sdk = await import("gluon-gold-sdk");
    const gluonInstance = new sdk.Gluon();
    gluonInstance.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";

    const [gluonBox, oracleBox] = await Promise.all([
      gluonInstance.getGluonBox(),
      gluonInstance.getGoldOracleBox(),
    ]);

    if (!gluonBox || !oracleBox) {
      updateSessionStatus(sessionId, "error", undefined, "Failed to fetch Gluon or Oracle box");
      return res.status(500).json({ 
        message: "Failed to fetch required blockchain data",
        messageSeverity: "ERROR" 
      });
    }

    const result = await handleTransmuteToGoldSwapErgoPay({
      gluonInstance,
      gluonBoxJs: gluonBox,
      oracleBoxJs: oracleBox,
      userAddress: address,
      nodeService: gluonInstance.nodeService,
      amount: session.fromAmount,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.reducedTx) {
      console.error("[ErgoPay Transmute-to-Gold] Handler returned no reducedTx");
      updateSessionStatus(sessionId, "error", undefined, "Failed to generate reduced transaction");
      return res.status(500).json({ 
        message: "Failed to generate reduced transaction",
        messageSeverity: "ERROR" 
      });
    }

    const reducedTx = result.reducedTx;

    // Use hardcoded canonical origin to prevent host header injection
    const canonicalOrigin = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://gluon.gold';
    const replyToUrl = `${canonicalOrigin}/api/ergopay/callback/${sessionId}`;

    return res.status(200).json({
      reducedTx,
      address,
      message: "Transmutation",
      messageSeverity: "INFORMATION",
      replyTo: replyToUrl,
    });

  } catch (error: any) {
    console.error(`Error processing Transmute to Gold transaction:`, error);
    
    if (error.message?.includes("insufficient") || error.message?.includes("balance")) {
      updateSessionStatus(sessionId as string, "insufficient-funds", undefined, error.message);
      return res.status(400).json({ 
        message: error.message || "Insufficient balance for transaction",
        messageSeverity: "WARNING" 
      });
    }

    updateSessionStatus(sessionId as string, "error", undefined, error.message);
    return res.status(500).json({ 
      message: error.message || "Failed to build transaction",
      messageSeverity: "ERROR" 
    });
  }
}
