
export type MessageSeverity = "INFORMATION" | "WARNING" | "ERROR";

export interface ErgoPaySigningRequest {
  reducedTx?: string;
  address?: string; 
  message?: string; 
  messageSeverity?: MessageSeverity;
  replyTo?: string;
}

export interface ErgoPayTransactionId {
  txId: string;
}
