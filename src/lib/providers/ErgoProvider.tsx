// @ts-nocheck
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

// Declare global window types for EIP-12
declare global {
  interface Window {
    ergoConnector?: {
      nautilus: {
        connect: () => Promise<boolean>;
        isConnected: () => Promise<boolean>;
        isAuthorized?: () => Promise<boolean>; // Optional: may not exist in all wallet versions
      };
      // Add other wallets if needed
    };
    ergo?: {
      get_balance: (assetId?: string | "ERG" | "all") => Promise<string | Array<{ tokenId: string; balance: string }>>;
      get_change_address: () => Promise<string>;
      get_unused_addresses: () => Promise<string[]>;
      get_used_addresses: () => Promise<string[]>;
      get_utxos: (filter?: { tokens: Array<{ tokenId: string; amount?: string }> }) => Promise<any[]>;
      get_current_height: () => Promise<number>;
      sign_tx: (tx: any) => Promise<any>;
      submit_tx: (tx: any) => Promise<string>;
      sign_data: (address: string, message: string) => Promise<string>;
    };
  }
}

interface WalletInfo {
  connectName: string;
  icon: string;
  name: string;
}

interface ErgoContextType {
  walletList: WalletInfo[];
  isConnected: boolean;
  isInitialized: boolean;
  connect: (walletName: string) => Promise<boolean>;
  disconnect: () => void;
  getChangeAddress: () => Promise<string>;
  signMessage: (address: string, message: string) => Promise<string>;
  getBalance: () => Promise<any>;
  getUtxos: () => Promise<any>;
  SignAndSubmitTx: (tx: any) => Promise<any>;
  ergoWallet: typeof window.ergo | undefined;
}

const ErgoContext = createContext<ErgoContextType | undefined>(undefined);

export function ErgoProvider({ children }: { children: React.ReactNode }) {
  const [walletList, setWalletList] = useState<WalletInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ergoWallet, setErgoWallet] = useState<typeof window.ergo>();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize available wallets and check for existing connection
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const { ergoConnector } = window;
    if (!ergoConnector) {
      setIsInitialized(true);
      return;
    }

    const availableWallets: WalletInfo[] = Object.keys(ergoConnector).map((walletName) => ({
      connectName: walletName,
      icon:
        walletName.toLowerCase() === "nautilus"
          ? "https://user-images.githubusercontent.com/96133754/196057495-45bcca0f-a4de-4905-85ea-fbcdead01b42.svg"
          : "https://example.com/default-wallet-icon.png",
    }));

    setWalletList(availableWallets);

    // Check for existing wallet connection on page load
    // Fix for Issue #51: Use isAuthorized() to check for prior authorization,
    // then silently reconnect if authorized but not connected
    const checkExistingConnection = async () => {
      try {
        const savedWallet = localStorage.getItem("connectedWallet");
        
        if (savedWallet && ergoConnector[savedWallet]) {
          const wallet = ergoConnector[savedWallet];
          
          // First check if already connected
          const isStillConnected = await wallet.isConnected();
          
          if (isStillConnected) {
            // Wait for window.ergo to be injected
            let retries = 0;
            while (!window.ergo && retries < 20) {
              await new Promise((resolve) => setTimeout(resolve, 200));
              retries++;
            }

            if (window.ergo) {
              setIsConnected(true);
              setErgoWallet(window.ergo);
            }
          } else {
            // Not connected - check if user is still authorized (Issue #51 fix)
            // If authorized, silently reconnect without user interaction
            try {
              // Check if isAuthorized method exists (may not be available in all wallet versions)
              if (wallet.isAuthorized && typeof wallet.isAuthorized === 'function') {
                const isAuthorized = await wallet.isAuthorized();
                
                if (isAuthorized) {
                  console.log(" Wallet authorized but not connected, attempting silent reconnect...");
                  
                  // Silently reconnect since user has already authorized
                  const reconnected = await wallet.connect();
                  
                  if (reconnected) {
                    // Wait for window.ergo to be injected
                    let retries = 0;
                    while (!window.ergo && retries < 20) {
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      retries++;
                    }

                    if (window.ergo) {
                      setIsConnected(true);
                      setErgoWallet(window.ergo);
                      console.log(" Wallet reconnected successfully after page refresh");
                    }
                  }
                }
              }
            } catch (authError) {
              // isAuthorized() may not exist or may throw - this is okay, just log and continue
              console.log("isAuthorized() not available or failed, skipping auto-reconnect:", authError);
            }
          }
        }
      } catch (error) {
        console.error("Error checking existing connection:", error);
        localStorage.removeItem("connectedWallet");
      } finally {
        setIsInitialized(true);
      }
    };

    checkExistingConnection();
  }, []);

  // Periodic check for wallet restoration
  // Fix for Issue #51: Attempt reconnect if authorized before disconnecting
  React.useEffect(() => {
    if (!isInitialized) return;

    const checkForWalletRestoration = async () => {
      const savedWallet = localStorage.getItem("connectedWallet");
      
      if (savedWallet && window.ergoConnector?.[savedWallet]) {
        try {
          const wallet = window.ergoConnector[savedWallet];
          const walletIsConnected = await wallet.isConnected();
          
          if (walletIsConnected && window.ergo) {
            // Always update wallet state if window.ergo is available
            setIsConnected(true);
            setErgoWallet(window.ergo);
          } else if (!walletIsConnected) {
            // Not connected - check if still authorized before disconnecting (Issue #51 fix)
            try {
              if (wallet.isAuthorized && typeof wallet.isAuthorized === 'function') {
                const isAuthorized = await wallet.isAuthorized();
                
                if (isAuthorized) {
                  // User is still authorized, attempt silent reconnect
                  console.log("🔄 Periodic check: Wallet authorized but not connected, attempting reconnect...");
                  const reconnected = await wallet.connect();
                  
                  if (reconnected && window.ergo) {
                    setIsConnected(true);
                    setErgoWallet(window.ergo);
                    console.log(" Wallet reconnected via periodic check");
                    return; // Successfully reconnected, don't disconnect
                  }
                }
              }
            } catch (authError) {
              // isAuthorized() may not exist or may throw - this is okay
              console.log("isAuthorized() check failed in periodic check:", authError);
            }
            
            // Only disconnect if not authorized or reconnect failed
            console.log(" Wallet no longer connected and not authorized, disconnecting...");
            setIsConnected(false);
            setErgoWallet(undefined);
            localStorage.removeItem("connectedWallet");
          }
        } catch (error) {
          // Wallet not available, continue checking
          console.log("Error in wallet restoration check:", error);
        }
      }
    };

    const interval = setInterval(checkForWalletRestoration, 2000);
    return () => clearInterval(interval);
  }, [isInitialized]);

  const connect = useCallback(async (walletName: string): Promise<boolean> => {
    try {
      const { ergoConnector } = window;

      if (!ergoConnector?.[walletName]) {
        throw new Error("Wallet connector not found");
      }

      const connected = await ergoConnector[walletName].connect();

      if (!connected) {
        throw new Error("Failed to connect to wallet");
      }

      // Wait for window.ergo to be injected (with retry mechanism)
      let retries = 0;
      const maxRetries = 10;
      while (!window.ergo && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
        retries++;
      }

      if (!window.ergo) {
        throw new Error("Wallet API (window.ergo) not available after connection");
      }

      // Verify the connection
      const isWalletConnected = await ergoConnector[walletName].isConnected();

      console.log(" Wallet connected successfully:", {
        walletName,
        isConnected: isWalletConnected,
        ergoAvailable: !!window.ergo,
      });

      setIsConnected(isWalletConnected);
      setErgoWallet(window.ergo);
      
      if (isWalletConnected) {
        localStorage.setItem("connectedWallet", walletName);
      }
      
      return isWalletConnected;
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      disconnect();
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setErgoWallet(undefined);
    localStorage.removeItem("connectedWallet");
  }, []);

  const signMessage = useCallback(async (address: string, message: string): Promise<string> => {
    const { ergo } = window;
    if (!ergo) throw new Error("Ergo object not found");

    try {
      return await ergo.sign_data(address, message);
    } catch (error) {
      console.error("Error signing message:", error);
      throw error;
    }
  }, []);

  const getChangeAddress = useCallback(async (): Promise<string> => {
    const { ergo, ergoConnector } = window;

    if (!ergo || !ergoConnector) {
      throw new Error("Ergo object not found");
    }

    // Double check connection before proceeding
    const isWalletConnected = await ergoConnector.nautilus.isConnected();
    if (!isWalletConnected) {
      throw new Error("Wallet not connected");
    }

    try {
      return await ergo.get_change_address();
    } catch (error) {
      console.error("Error getting change address:", error);
      throw error;
    }
  }, []);

  const getBalance = useCallback(async (): Promise<Array<{ tokenId: string; balance: string }>> => {
    const { ergo, ergoConnector } = window;

    if (!ergo || !ergoConnector) {
      throw new Error("Ergo object not found");
    }

    // Double check connection before proceeding
    const isWalletConnected = await ergoConnector.nautilus.isConnected();
    if (!isWalletConnected) {
      throw new Error("Wallet not connected");
    }

    try {
      // Get ERG balance
      const balance = (await ergo.get_balance("all")) as Array<{
        tokenId: string;
        balance: string;
      }>;

      return balance;
    } catch (error) {
      console.error("Error getting balance:", error);
      throw error;
    }
  }, []);

  const getUtxos = useCallback(async (): Promise<any[]> => {
    const { ergo, ergoConnector } = window;
    if (!ergo || !ergoConnector) {
      throw new Error("Ergo object not found");
    }
    try {
      return await ergo.get_utxos();
    } catch (error) {
      console.error("Error getting utxos:", error);
      throw error;
    }
  }, []);

  const SignAndSubmitTx = useCallback(async (tx: any): Promise<any> => {
    // not tested yet, sdk not working on testnet
    const { ergo, ergoConnector } = window;
    if (!ergo || !ergoConnector) {
      throw new Error("Ergo object not found");
    }
    try {
      const signedTx = await ergo.sign_tx(tx);
      console.log("signed tx", signedTx);
      const submittedTx = await ergo.submit_tx(signedTx);
      console.log("submitted tx", submittedTx);
      return submittedTx;
    } catch (error) {
      console.error("Error signing and submitting transaction:", error);
      throw error;
    }
  }, []);

  return (
    <ErgoContext.Provider
      value={{
        walletList,
        isConnected,
        isInitialized,
        connect,
        disconnect,
        getChangeAddress,
        getBalance,
        signMessage,
        getUtxos,
        SignAndSubmitTx,
        ergoWallet,
      }}
    >
      {children}
    </ErgoContext.Provider>
  );
}

export function useErgo() {
  const context = useContext(ErgoContext);
  if (!context) {
    throw new Error("useErgo must be used within an ErgoProvider");
  }
  return context;
}
