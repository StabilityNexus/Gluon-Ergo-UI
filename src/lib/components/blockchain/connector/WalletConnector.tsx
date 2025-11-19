"use client";

import { Button } from "@/lib/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/lib/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/lib/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/ui/tabs";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { WalletIcon, LogOut, ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function WalletConnector() {
  const { walletList, isConnected, isInitialized, isRestoringConnection, connect, disconnect, getChangeAddress, getBalance, ergoWallet } = useErgo();
  const [isOpen, setIsOpen] = useState(false);
  const [ergoAddress, setErgoAddress] = useState<string | null>(null);
  const [ergBalance, setErgoBalance] = useState<string | null>("0");
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  console.log(ergBalance); // To avoid linting error

  // Fetch address and balance when wallet becomes connected (including after auto-reconnect)
  useEffect(() => {
    if (isConnected && ergoWallet && !ergoAddress) {
      // Wallet is connected but address not fetched yet - fetch it now
      getChangeAddress()
        .then(async (address) => {
          setErgoAddress(address);
          try {
            const ergoTokens = await getBalance();
            const ergBalance = ergoTokens.find((item: any) => item.tokenId === "ERG");
            if (ergBalance) {
              const balance = parseInt(ergBalance.balance) / 1000000000;
              setErgoBalance(balance.toString());
            }
          } catch (error) {
            console.error("Error fetching balance:", error);
          }
        })
        .catch((error) => {
          console.error("Error fetching address:", error);
        });
    } else if (!isConnected && ergoAddress) {
      // Wallet disconnected - clear address and balance
      setErgoAddress(null);
      setErgoBalance("0");
    }
  }, [isConnected, ergoWallet, ergoAddress, getChangeAddress, getBalance]);

  // Legacy effect for manual connection (kept for backward compatibility)
  useEffect(() => {
    const savedWallet = localStorage.getItem("connectedWallet");
    const isLoaded = walletList.find((wallet) => wallet.connectName === savedWallet);
    // Only try to connect if not already connected and wallet is loaded
    if (savedWallet && isLoaded && !isConnected) {
      connect(savedWallet)
        .then(async (success) => {
          if (success) {
            const address = await getChangeAddress();
            setErgoAddress(address);
            const ergoTokens = await getBalance();
            const ergBalance = ergoTokens.find((item: any) => item.tokenId === "ERG");
            if (ergBalance) {
              const balance = parseInt(ergBalance.balance) / 1000000000;
              setErgoBalance(balance.toString());
            }
          }
        })
        .catch(console.error);
    }
  }, [connect, isConnected, getChangeAddress, walletList, getBalance]);

  const handleConnect = async (walletName: string) => {
    try {
      setConnectingWallet(walletName);
      console.log("Attempting to connect to wallet:", walletName);

      if (!window.ergoConnector) {
        console.error("Ergo connector not found. Is Nautilus installed?");
        return;
      }

      const success = await connect(walletName);
      console.log("Connection result:", success);

      if (success) {
        try {
          const address = await getChangeAddress();
          console.log("Connected address:", address);
          setErgoAddress(address);
          
          const ergoTokens = await getBalance();
          console.log("Connected balance:", ergoTokens);
          const ergBalance = ergoTokens.find((item: any) => item.tokenId === "ERG");
          if (ergBalance) {
            const balance = parseInt(ergBalance.balance) / 1000000000;
            setErgoBalance(balance.toString());
          }
          
          localStorage.setItem("connectedWallet", walletName);
          setIsOpen(false);
        } catch (error) {
          console.error("Error fetching address/balance after connection:", error);
          // Still close the drawer even if fetching fails
          setIsOpen(false);
        }
      }
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem("connectedWallet");
    setErgoAddress(null);
    setErgoBalance(null);
  };

  if (isConnected && ergoAddress) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <WalletIcon className="h-4 w-4" />
            {`${ergoAddress.slice(0, 4)}...${ergoAddress.slice(-4)}`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleDisconnect}>
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const showLoadingState = !isInitialized || (isRestoringConnection && !isConnected);
  const triggerLabel = !isInitialized ? "Detecting wallets..." : isRestoringConnection && !isConnected ? "Reconnecting..." : "Connect Wallet";

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2" aria-busy={showLoadingState} disabled={!isInitialized}>
          {showLoadingState ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletIcon className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="z-[9999]">
        <DrawerHeader>
          <DrawerTitle className="text-center text-xl">Connect your wallet</DrawerTitle>
        </DrawerHeader>
        <div className="flex w-full max-w-md self-center p-4 pb-12">
          <Tabs defaultValue="browser" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browser">Browser Wallet</TabsTrigger>
              <TabsTrigger value="ergopay" disabled>
                Ergo Pay
              </TabsTrigger>
            </TabsList>
            <TabsContent value="browser">
              {!isInitialized ? (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
                  <p className="w-60 text-center">Loading wallets...</p>
                </div>
              ) : walletList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
                  <p className="w-60 text-center">No Ergo wallets installed, learn how to setup your Nautilus Wallet</p>

                  <Button
                    variant="ghost"
                    className="mt-2 border shadow-sm hover:bg-white hover:text-black"
                    onClick={() => window.open("https://ergoplatform.org/en/blog/2022-03-10-storing-crypto-on-ergo-nautilus-wallet/", "_blank")}
                  >
                    Get Started with Ergo <ArrowUpRight />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {walletList.map((wallet) => (
                    <Button
                      key={wallet.connectName}
                      variant="outline"
                      className="mt-3 w-full justify-start gap-2"
                      onClick={() => handleConnect(wallet.connectName)}
                      disabled={!!connectingWallet && connectingWallet !== wallet.connectName}
                    >
                      {connectingWallet === wallet.connectName ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <img src={wallet.icon} alt={wallet.connectName} className="h-6 w-6" />
                          {wallet.connectName}
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="ergopay">
              <div className="p-4 text-center text-muted-foreground">Ergo Pay here</div>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
