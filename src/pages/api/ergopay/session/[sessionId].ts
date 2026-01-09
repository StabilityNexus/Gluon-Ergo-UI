import type { NextApiRequest, NextApiResponse } from "next";
import { sessionMap } from "../roundTrip/[sessionId]/[address]";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Invalid sessionId" });
  }

  const address = sessionMap.get(sessionId);

  if (address) {
    return res.status(200).json({
      message: "connected",
      address,
    });
  }

  return res.status(200).json({
    message: "not connected",
  });
}
