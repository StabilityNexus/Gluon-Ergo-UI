import type { NextApiRequest, NextApiResponse } from "next";
import { updateSessionStatus, getSession } from "@/lib/utils/session-manager";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  try {
  
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { txId, status } = req.body;

    if (!txId) {
      console.error(` Callback received without txId for session ${sessionId}`);
      return res.status(400).json({ error: "Missing transaction ID" });
    }

    const updated = updateSessionStatus(sessionId, "submitted", txId);

    if (!updated) {
      return res.status(404).json({ error: "Failed to update session" });
    }

   
    return res.status(200).json({ 
      success: true,
      sessionId,
      txId,
      message: "Transaction received successfully" 
    });

  } catch (error) {
    console.error(`Error processing callback for session ${sessionId}:`, error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
