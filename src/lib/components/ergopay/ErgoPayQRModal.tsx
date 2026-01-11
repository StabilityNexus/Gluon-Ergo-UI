"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/lib/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/lib/components/ui/drawer";
import { Loader2, XCircle, CheckCircle2 } from "lucide-react";

interface ErgoPayQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressReceived: (address: string) => void;
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

export function ErgoPayQRModal({ isOpen, onClose, onAddressReceived }: ErgoPayQRModalProps) {
  const [sessionId] = useState(() => generateSessionId());
  const [status, setStatus] = useState<"polling" | "success" | "failed">("polling");
  const [receivedAddress, setReceivedAddress] = useState<string>("");
  const pollIntervalRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);
  const POLL_INTERVAL_MS = 5000;
  const MAX_ATTEMPTS = 6; 

  const getErgoPayHost = () => {
    if (typeof window !== "undefined") {
      return window.location.host;
    }
    return "gluon.gold";
  };

  const ergoPayUrl = `ergopay://${getErgoPayHost()}/api/ergopay/roundTrip/${sessionId}/#P2PK_ADDRESS#`;


  const startPolling = () => {
    setStatus("polling");
    attemptCountRef.current = 0;

    const pollForAddress = async () => {
      attemptCountRef.current++;

      try {
        const response = await fetch(`/api/ergopay/session/${sessionId}`);
        const data = await response.json();

        if (data.message === "connected" && data.address) {
          // Success! Got the address
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("success");
          setReceivedAddress(data.address);
          onAddressReceived(data.address);
          setTimeout(() => onClose(), 2000);
        } else if (attemptCountRef.current >= MAX_ATTEMPTS) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (attemptCountRef.current >= MAX_ATTEMPTS) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
        }
      }
    };


    pollForAddress();
    
    pollIntervalRef.current = window.setInterval(pollForAddress, POLL_INTERVAL_MS);
  };


  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      attemptCountRef.current = 0;
      setStatus("polling");
      setReceivedAddress("");
      return;
    }

    startPolling();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, sessionId, onAddressReceived, onClose]);

  const handleRetry = () => {
    setReceivedAddress("");
    startPolling();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="z-[10000]">
        <DrawerHeader>
          <DrawerTitle>Connect with ErgoPay</DrawerTitle>
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
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-2 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-500">✓ Wallet connected successfully!</p>
              <p className="text-xs text-muted-foreground">{receivedAddress.slice(0, 8)}...{receivedAddress.slice(-8)}</p>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">Session timeout - no wallet address received.</p>
              <p className="text-xs text-muted-foreground">Please scan the QR code within 30 seconds and try again.</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          )}

          <Button onClick={onClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
