import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, updateSessionStatus } from "@/lib/utils/session-manager";
import { handleFissionSwapErgoPay } from "@/lib/functions/reactor/handleFission";

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
      console.error("[ErgoPay Fission] Failed to fetch boxes:", { gluonBox: !!gluonBox, oracleBox: !!oracleBox });
      updateSessionStatus(sessionId, "error", undefined, "Failed to fetch Gluon or Oracle box");
      return res.status(500).json({ 
        message: "Failed to fetch required blockchain data",
        messageSeverity: "ERROR" 
      });
    }


    const result = await handleFissionSwapErgoPay(
      gluonInstance,
      gluonBox,
      oracleBox,
      address,
      session.fromAmount
    );


    if (result.error) {
      console.error("[ErgoPay Fission] Handler returned error:", result.error);
      throw new Error(result.error);
    }

    if (!result.reducedTx) {
      console.error("[ErgoPay Fission] Handler returned no reducedTx");
      throw new Error("Failed to generate reduced transaction");
    }

    const reducedTx = result.reducedTx;


    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const replyToUrl = `${protocol}://${host}/api/ergopay/callback/${sessionId}`;

    return res.status(200).json({
      reducedTx,
      address,
      message: `Fission: ${session.fromAmount} ERG → ${session.gauAmount} GAU + ${session.gaucAmount} GAUC`,
      messageSeverity: "INFORMATION",
      replyTo: replyToUrl,
    });

  } catch (error: any) {
    console.error(`[ErgoPay Fission]  Error processing transaction:`, error);
    
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
