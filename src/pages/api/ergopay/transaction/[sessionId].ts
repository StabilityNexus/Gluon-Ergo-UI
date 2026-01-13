import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/utils/session-manager";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  try {
    const session = getSession(sessionId);

    if (!session) {
      return res.status(404).json({ 
        status: "error",
        message: "Session not found or expired" 
      });
    }

    const response: any = {
      status: session.status,
      operationType: session.operationType,
    };

    if (session.txId) {
      response.txId = session.txId;
    }

    if (session.errorMessage) {
      response.message = session.errorMessage;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error(`Error retrieving session ${sessionId}:`, error);
    return res.status(500).json({ 
      status: "error",
      message: "Internal server error" 
    });
  }
}
