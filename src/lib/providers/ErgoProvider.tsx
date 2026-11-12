"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Amount, Box, EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { createEip12Wallet } from "@/lib/utils/eip12-wallet";

import type { WalletOperations } from "@/lib/functions/reactor/types";

interface ErgoConnectorWallet {
  connect: (params?: { createTx?: boolean }) => Promise<boolean>;
  isConnected: () => Promise<boolean>;
  isAuthorized?: () => Promise<boolean>;
}

// Declare global window types for EIP-12
declare global {
  interface Window {
    ergoConnector?: Record<string, ErgoConnectorWallet | undefined> & {
      nautilus: ErgoConnectorWallet;
    };
    ergo?: {
      get_balance: (assetId?: string | "ERG" | "all") => Promise<string | Array<{ tokenId: string; balance: string }>>;
      get_change_address: () => Promise<string>;
      get_unused_addresses: () => Promise<string[]>;
      get_used_addresses: () => Promise<string[]>;
      get_utxos: (filter?: { tokens: Array<{ tokenId: string; amount?: string }> }) => Promise<Box<Amount>[]>;
      get_current_height: () => Promise<number>;
      sign_tx: (tx: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
      submit_tx: (tx: SignedTransaction) => Promise<string>;
      sign_data: (address: string, message: string) => Promise<string>;
    };
  }
}

interface WalletInfo {
  connectName: string;
  icon: string;
  name?: string;
}

interface ErgoContextType {
  walletList: WalletInfo[];
  isConnected: boolean;
  isInitialized: boolean;
  isRestoringConnection: boolean;
  connect: (walletName: string) => Promise<boolean>;
  disconnect: () => void;
  getChangeAddress: () => Promise<string>;
  signMessage: (address: string, message: string) => Promise<string>;
  getBalance: () => Promise<Array<{ tokenId: string; balance: string }>>;
  getUtxos: () => Promise<Box<Amount>[]>;
  SignAndSubmitTx: (tx: EIP12UnsignedTransaction) => Promise<string>;
  signTx: (tx: EIP12UnsignedTransaction) => Promise<SignedTransaction>;
  submitTx: (tx: SignedTransaction) => Promise<string>;
  walletOps: WalletOperations;
  ergoWallet: typeof window.ergo | undefined;
}

const ErgoContext = createContext<ErgoContextType | undefined>(undefined);

export function ErgoProvider({ children }: { children: React.ReactNode }) {
  const [walletList, setWalletList] = useState<WalletInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ergoWallet, setErgoWallet] = useState<typeof window.ergo>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoringConnection, setIsRestoringConnection] = useState(true);

  // Initialize available wallets and check for existing connection
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForErgoConnector = async () => {
      let attempts = 0;
      const maxAttempts = 25;
      while (attempts < maxAttempts) {
        if (window.ergoConnector && Object.keys(window.ergoConnector).length > 0) {
          return window.ergoConnector;
        }
        await wait(200);
        attempts++;
      }
      return undefined;
    };

    // Check for existing wallet connection on page load
    // Fix for Issue #51: Use isAuthorized() to check for prior authorization,
    // then silently reconnect if authorized but not connected
    const checkExistingConnection = async (ergoConnector: typeof window.ergoConnector) => {
      try {
        const savedWallet = localStorage.getItem("connectedWallet");

        if (savedWallet && ergoConnector?.[savedWallet]) {
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
              if (wallet.isAuthorized && typeof wallet.isAuthorized === "function") {
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
      }
    };

    const initializeWallets = async () => {
      setIsRestoringConnection(true);
      const ergoConnector = await waitForErgoConnector();

      if (!isMounted) {
        return;
      }

      if (!ergoConnector) {
        setIsInitialized(true);
        setIsRestoringConnection(false);
        return;
      }

      const availableWallets: WalletInfo[] = Object.keys(ergoConnector).map((walletName) => ({
        connectName: walletName,
        name: walletName,
        icon:
          walletName.toLowerCase() === "nautilus"
            ? "https://user-images.githubusercontent.com/96133754/196057495-45bcca0f-a4de-4905-85ea-fbcdead01b42.svg"
            : "https://example.com/default-wallet-icon.png",
      }));

      setWalletList(availableWallets);
      await checkExistingConnection(ergoConnector);

      if (isMounted) {
        setIsInitialized(true);
        setIsRestoringConnection(false);
      }
    };

    initializeWallets();

    return () => {
      isMounted = false;
    };
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
            setIsRestoringConnection(false);
          } else if (!walletIsConnected) {
            // Not connected - check if still authorized before disconnecting (Issue #51 fix)
            try {
              if (wallet.isAuthorized && typeof wallet.isAuthorized === 'function') {
                const isAuthorized = await wallet.isAuthorized();
                
                if (isAuthorized) {
                  // User is still authorized, attempt silent reconnect
                  console.log("Periodic check: Wallet authorized but not connected, attempting reconnect...");
                  setIsRestoringConnection(true);
                  const reconnected = await wallet.connect();
                  
                  if (reconnected) {
                    // Wait for window.ergo to be injected, same as other connect paths
                    let retries = 0;
                    const maxRetries = 20;
                    while (!window.ergo && retries < maxRetries) {
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      retries++;
                    }

                    if (window.ergo) {
                      setIsConnected(true);
                      setErgoWallet(window.ergo);
                      console.log("Wallet reconnected via periodic check");
                      setIsRestoringConnection(false);
                      return; // Successfully reconnected, don't disconnect
                    }
                  }
                }
              }
            } catch (authError) {
              // isAuthorized() may not exist or may throw - this is okay
              console.log("isAuthorized() check failed in periodic check:", authError);
            }
            
            // Only disconnect if not authorized or reconnect failed / API unavailable
            console.log("Wallet no longer connected and not authorized or reconnect failed, disconnecting...");
            setIsConnected(false);
            setErgoWallet(undefined);
            localStorage.removeItem("connectedWallet");
            setIsRestoringConnection(false);
          }
        } catch (error) {
          // Wallet not available, continue checking
          console.log("Error in wallet restoration check:", error);
          setIsRestoringConnection(false);
        }
      } else {
        setIsRestoringConnection(false);
      }
    };

    const interval = setInterval(checkForWalletRestoration, 2000);
    return () => clearInterval(interval);
  }, [isInitialized]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setErgoWallet(undefined);
    localStorage.removeItem("connectedWallet");
  }, []);

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
  }, [disconnect]);

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

  const isConnectedRef = React.useRef(isConnected);
  React.useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const walletOps = useMemo<WalletOperations>(() => {
    const raw = createEip12Wallet(() => (typeof window === "undefined" ? undefined : window.ergo));
    return {
      getUtxos: async (): Promise<Box<Amount>[]> => {
        if (!isConnectedRef.current) {
          throw new Error("Ergo wallet not connected");
        }
        return raw.getUtxos();
      },
      getChangeAddress: async (): Promise<string> => {
        if (!isConnectedRef.current) {
          throw new Error("Ergo wallet not connected");
        }
        return raw.getChangeAddress();
      },
      signTx: async (tx: EIP12UnsignedTransaction): Promise<SignedTransaction> => {
        if (!isConnectedRef.current) {
          throw new Error("Ergo wallet not connected");
        }
        return raw.signTx(tx);
      },
      submitTx: async (tx: SignedTransaction): Promise<string> => {
        if (!isConnectedRef.current) {
          throw new Error("Ergo wallet not connected");
        }
        return raw.submitTx(tx);
      },
    };
  }, []);

  const getUtxos = useCallback(async (): Promise<Box<Amount>[]> => {
    return walletOps.getUtxos();
  }, [walletOps]);

  const SignAndSubmitTx = useCallback(
    async (tx: EIP12UnsignedTransaction): Promise<string> => {
      const signedTx = await walletOps.signTx(tx);
      return await walletOps.submitTx(signedTx);
    },
    [walletOps]
  );

  return (
    <ErgoContext.Provider
      value={{
        walletList,
        isConnected,
        isInitialized,
        isRestoringConnection,
        connect,
        disconnect,
        getChangeAddress,
        getBalance,
        signMessage,
        getUtxos,
        SignAndSubmitTx,
        signTx: walletOps.signTx,
        submitTx: walletOps.submitTx,
        walletOps,
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
