
export interface ErgoPaySession {
  sessionId: string;
  operationType: "fission" | "fusion" | "transmute-to-gold" | "transmute-from-gold";
  fromAmount: string;
  toAmount: string;
  gauAmount: string;
  gaucAmount: string;
  fromToken: string;
  toToken: string;
  address?: string; // Wallet address for ErgoPay connection
  fees?: {
    totalFee: string;
    blockchainFee: string;
    gluonFee: string;
  };
  status: "pending" | "submitted" | "error" | "insufficient-funds";
  txId?: string;
  errorMessage?: string;
  createdAt: number;
}

const globalForSessions = global as unknown as {
  ergoPaySessions: Map<string, ErgoPaySession> | undefined;
};

const sessions = globalForSessions.ergoPaySessions ?? new Map<string, ErgoPaySession>();

if (process.env.NODE_ENV !== "production") {
  globalForSessions.ergoPaySessions = sessions;
}

const SESSION_EXPIRATION_MS = 15 * 60 * 1000;


export function storeSession(sessionData: Omit<ErgoPaySession, "status" | "createdAt">): void {
  sessions.set(sessionData.sessionId, {
    ...sessionData,
    status: "pending",
    createdAt: Date.now(),
  });
}

export function getSession(sessionId: string): ErgoPaySession | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  if (Date.now() - session.createdAt > SESSION_EXPIRATION_MS) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

export function updateSessionStatus(
  sessionId: string,
  status: ErgoPaySession["status"],
  txId?: string,
  errorMessage?: string
): boolean {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return false;
  }
  
  session.status = status;
  if (txId) session.txId = txId;
  if (errorMessage) session.errorMessage = errorMessage;
  
  return true;
}

export function updateSessionAddress(
  sessionId: string,
  address: string
): boolean {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return false;
  }
  
  session.address = address;
  
  return true;
}

/**
 * Store or update an address for a session, creating a minimal session if needed.
 * Used for address-only capture (roundTrip flow) where no transaction exists yet.
 */
export function storeOrUpdateAddress(
  sessionId: string,
  address: string
): void {
  const session = sessions.get(sessionId);
  
  if (session) {
    // Update existing session
    session.address = address;
  } else {
    // Create minimal session for address capture only
    sessions.set(sessionId, {
      sessionId,
      operationType: "fission", // Placeholder, will be set when actual transaction is initiated
      fromAmount: "0",
      toAmount: "0",
      gauAmount: "0",
      gaucAmount: "0",
      fromToken: "",
      toToken: "",
      address,
      status: "pending",
      createdAt: Date.now(),
    });
  }
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_EXPIRATION_MS) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  return cleanedCount;
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
}
