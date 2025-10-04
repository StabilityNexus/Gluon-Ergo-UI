import type { NextApiRequest, NextApiResponse } from "next";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

type Data =
  | {
      price: number;
      timestamp: number;
    }
  | {
      error: string;
    };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd", {
      headers: {
        accept: "application/json",
        "x-cg-demo-api-key": COINGECKO_API_KEY || "",
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ergo?.usd) {
      throw new Error("Invalid response format from CoinGecko");
    }

    res.status(200).json({
      price: data.ergo.usd,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Failed to fetch ERG price:", error);
    res.status(500).json({ error: "Failed to fetch ERG price" });
  }
}
