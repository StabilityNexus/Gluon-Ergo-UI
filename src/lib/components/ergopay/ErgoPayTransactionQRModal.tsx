"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/lib/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/lib/components/ui/drawer";
import { Loader2, XCircle, CheckCircle2, AlertCircle } from "lucide-react";

interface ErgoPayTransactionQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  operationType: "fission" | "fusion" | "transmute-to-gold" | "transmute-from-gold";
  onTransactionSubmitted?: (txId: string) => void;
}

function getOperationName(operation: string): string {
  const names: Record<string, string> = {
    fission: "Fission (ERG → GAU + GAUC)",
    fusion: "Fusion (GAU + GAUC → ERG)",
    "transmute-to-gold": "Transmutation (GAUC → GAU)",
    "transmute-from-gold": "Transmutation (GAU → GAUC)",
  };
  return names[operation] || operation;
}

export function ErgoPayTransactionQRModal({
  isOpen,
  onClose,
  sessionId,
  operationType,
  onTransactionSubmitted,
}: ErgoPayTransactionQRModalProps) {
  const [status, setStatus] = useState<"polling" | "success" | "failed" | "insufficient-funds">("polling");
  const [txId, setTxId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const pollIntervalRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);
  const POLL_INTERVAL_MS = 10000; 
  const MAX_POLL_DURATION_MS = 2 * 60 * 1000; 
  const MAX_ATTEMPTS = Math.ceil(MAX_POLL_DURATION_MS / POLL_INTERVAL_MS);

  const getErgoPayUrl = () => {
    if (typeof window === "undefined") {
      return `ergopay://gluon.gold/api/ergopay/${operationType}/${sessionId}/#P2PK_ADDRESS#`;
    }
    return `ergopay://${window.location.host}/api/ergopay/${operationType}/${sessionId}/#P2PK_ADDRESS#`;
  };

  const ergoPayUrl = getErgoPayUrl();

  const startPolling = () => {
    setStatus("polling");
    attemptCountRef.current = 0;
    setTxId("");
    setErrorMessage("");

    const pollForTransaction = async () => {
      attemptCountRef.current++;

      try {
        const response = await fetch(`/api/ergopay/transaction/${sessionId}`);
        const data = await response.json();

        if (data.status === "submitted" && data.txId) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("success");
          setTxId(data.txId);
          onTransactionSubmitted?.(data.txId);
          setTimeout(() => onClose(), 3000);
        } else if (data.status === "insufficient-funds") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("insufficient-funds");
          setErrorMessage(data.message || "Insufficient funds in wallet");
        } else if (data.status === "error") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
          setErrorMessage(data.message || "Transaction failed");
        } else if (attemptCountRef.current >= MAX_ATTEMPTS) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
          setErrorMessage("Transaction timeout - no response from wallet");
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (attemptCountRef.current >= MAX_ATTEMPTS) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
          setErrorMessage("Failed to connect to server");
        }
      }
    };

    pollForTransaction();

    pollIntervalRef.current = window.setInterval(pollForTransaction, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      attemptCountRef.current = 0;
      setStatus("polling");
      setTxId("");
      setErrorMessage("");
      return;
    }

    startPolling();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, sessionId]);

  const handleRetry = () => {
    setTxId("");
    setErrorMessage("");
    startPolling();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="z-[10000]">
        <DrawerHeader>
          <DrawerTitle>{getOperationName(operationType)}</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-4 p-6">
          {status === "polling" && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={ergoPayUrl} size={256} level="M" includeMargin />
              </div>
              <Button
                asChild
                variant="default"
                className="w-full md:hidden"
              >
                <a href={ergoPayUrl} rel="noopener noreferrer">
                  Open in Wallet
                </a>
              </Button>
              <div className="space-y-2 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Scan QR code with Ergo Wallet App</p>
                <p className="text-xs text-muted-foreground">
                  The wallet will check your balance and return the transaction
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-2 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-500">✓ Transaction submitted successfully!</p>
              <p className="text-xs text-muted-foreground">TX ID: {txId.slice(0, 16)}...</p>
              <a
                href={`https://explorer.ergoplatform.com/en/transactions/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline hover:text-primary/80"
              >
                View on Explorer
              </a>
            </div>
          )}

          {status === "insufficient-funds" && (
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-yellow-500" />
              <p className="text-sm font-medium text-yellow-500">Insufficient Funds</p>
              <p className="text-xs text-muted-foreground">{errorMessage}</p>
              <p className="text-xs text-muted-foreground">
                Please ensure you have enough tokens and ERG for transaction fees.
              </p>
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">Transaction Failed</p>
              <p className="text-xs text-muted-foreground">{errorMessage || "An error occurred"}</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          )}

          <Button onClick={onClose} variant="outline" className="w-full">
            {status === "success" ? "Close" : "Cancel"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
