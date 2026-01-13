import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/utils/session-manager";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Invalid sessionId" });
  }

  // Get session from centralized session manager
  const session = getSession(sessionId);
  
  if (session?.address) {
    return res.status(200).json({
      message: "connected",
      address: session.address,
    });
  }

  return res.status(200).json({
    message: "not connected",
  });
}
