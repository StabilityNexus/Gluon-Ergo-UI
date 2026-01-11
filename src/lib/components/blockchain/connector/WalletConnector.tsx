"use client";

import { Button } from "@/lib/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/lib/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/lib/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/ui/tabs";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { WalletIcon, LogOut, ArrowUpRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ErgoPayQRModal } from "@/lib/components/ergopay/ErgoPayQRModal";
import { useErgoPay } from "@/lib/providers/ErgoPayProvider";
import { nanoErgsToErgs, convertFromDecimals, format as formatTokenValue } from "@/lib/utils/erg-converter";
import { TOKEN_ADDRESS } from "@/lib/constants/token";
import GauIcon from "@/lib/components/icons/GauIcon";
import GaucIcon from "@/lib/components/icons/GaucIcon";

export function WalletConnector() {
  const { walletList, isConnected, isInitialized, isRestoringConnection, connect, disconnect, getChangeAddress, getBalance, ergoWallet } = useErgo();
  const [isOpen, setIsOpen] = useState(false);
  const [ergoAddress, setErgoAddress] = useState<string | null>(null);
  const [ergBalance, setErgoBalance] = useState<string | null>("0");
  const [gauBalance, setGauBalance] = useState<string>("0");
  const [gaucBalance, setGaucBalance] = useState<string>("0");
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [showErgoPayModal, setShowErgoPayModal] = useState(false);
  const [showErgoPayDrawer, setShowErgoPayDrawer] = useState(false);
  const [showBrowserWalletDrawer, setShowBrowserWalletDrawer] = useState(false);
  const { address: ergoPayAddress, setAddress: setErgoPayAddress, clearAddress: clearErgoPayAddress, balances: ergoPayBalances, setBalances: setErgoPayBalances } = useErgoPay();

  console.log(ergBalance);

  useEffect(() => {
    if (isConnected && ergoWallet && !ergoAddress) {
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
            
            // Fetch GAU and GAUC balances
            const gauToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gau);
            const gaucToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gauc);
            
            if (gauToken) {
              const balance = convertFromDecimals(gauToken.balance, gauToken.decimals ?? TOKEN_ADDRESS.decimals);
              setGauBalance(balance.toString());
            }
            
            if (gaucToken) {
              const balance = convertFromDecimals(gaucToken.balance, gaucToken.decimals ?? TOKEN_ADDRESS.decimals);
              setGaucBalance(balance.toString());
            }
          } catch (error) {
            console.error("Error fetching balance:", error);
          }
        })
        .catch((error) => {
          console.error("Error fetching address:", error);
        });
    } else if (!isConnected && ergoAddress) {
      setErgoAddress(null);
      setErgoBalance("0");
      setGauBalance("0");
      setGaucBalance("0");
    }
  }, [isConnected, ergoWallet, ergoAddress, getChangeAddress, getBalance]);

  useEffect(() => {
    const savedWallet = localStorage.getItem("connectedWallet");
    const isLoaded = walletList.find((wallet) => wallet.connectName === savedWallet);
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
            
            // Fetch GAU and GAUC balances
            const gauToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gau);
            const gaucToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gauc);
            
            if (gauToken) {
              const balance = convertFromDecimals(gauToken.balance, gauToken.decimals ?? TOKEN_ADDRESS.decimals);
              setGauBalance(balance.toString());
            }
            
            if (gaucToken) {
              const balance = convertFromDecimals(gaucToken.balance, gaucToken.decimals ?? TOKEN_ADDRESS.decimals);
              setGaucBalance(balance.toString());
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
          
          // Fetch GAU and GAUC balances
          const gauToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gau);
          const gaucToken = ergoTokens.find((item: any) => item.tokenId === TOKEN_ADDRESS.gauc);
          
          if (gauToken) {
            const balance = convertFromDecimals(gauToken.balance, gauToken.decimals ?? TOKEN_ADDRESS.decimals);
            setGauBalance(balance.toString());
          }
          
          if (gaucToken) {
            const balance = convertFromDecimals(gaucToken.balance, gaucToken.decimals ?? TOKEN_ADDRESS.decimals);
            setGaucBalance(balance.toString());
          }
          
          localStorage.setItem("connectedWallet", walletName);
          setIsOpen(false);
        } catch (error) {
          console.error("Error fetching address/balance after connection:", error);
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
    setGauBalance("0");
    setGaucBalance("0");
    setShowBrowserWalletDrawer(false);
  };

  const fetchErgoPayBalances = useCallback(async (address: string) => {
    try {
      const response = await fetch(`https://api.ergoplatform.com/api/v1/addresses/${address}/balance/total`);
      if (!response.ok) {
        throw new Error("Failed to fetch ErgoPay balances");
      }

      const data = await response.json();
      const confirmed = data?.confirmed ?? {};
      const tokens = confirmed.tokens ?? [];

      const gauToken = tokens.find((token: any) => token.tokenId === TOKEN_ADDRESS.gau);
      const gaucToken = tokens.find((token: any) => token.tokenId === TOKEN_ADDRESS.gauc);

      const nextBalances = {
        erg: nanoErgsToErgs(confirmed.nanoErgs ?? 0).toString(),
        gau: gauToken ? convertFromDecimals(gauToken.amount, gauToken.decimals ?? TOKEN_ADDRESS.decimals).toString() : "0",
        gauc: gaucToken ? convertFromDecimals(gaucToken.amount, gaucToken.decimals ?? TOKEN_ADDRESS.decimals).toString() : "0",
      };

      setErgoPayBalances(nextBalances);
    } catch (error) {
      console.error("Error fetching ErgoPay balance:", error);
      setErgoPayBalances({ erg: "0", gau: "0", gauc: "0" });
    }
  }, [setErgoPayBalances]);

  const handleErgoPayAddress = (address: string) => {
    console.log("ErgoPay address received:", address);
    setErgoPayAddress(address);
  };

  const handleErgoPayDisconnect = () => {
    clearErgoPayAddress();
    setShowErgoPayDrawer(false);
  };

  useEffect(() => {
    if (ergoPayAddress) {
      fetchErgoPayBalances(ergoPayAddress);
    } else {
      setErgoPayBalances({ erg: "0", gau: "0", gauc: "0" });
    }
  }, [ergoPayAddress, fetchErgoPayBalances, setErgoPayBalances]);

  const formatBalance = (value: string) => formatTokenValue(value || "0");

  if (isConnected && ergoAddress) {
    return (
      <>
        <Button variant="outline" className="gap-2" onClick={() => setShowBrowserWalletDrawer(true)}>
          <WalletIcon className="h-4 w-4" />
          {`${ergoAddress.slice(0, 4)}...${ergoAddress.slice(-4)}`}
        </Button>
        <Drawer open={showBrowserWalletDrawer} onOpenChange={setShowBrowserWalletDrawer}>
          <DrawerContent className="z-[9999]">
            <DrawerHeader>
              <DrawerTitle className="text-center text-xl text-primary">Browser Wallet</DrawerTitle>
            </DrawerHeader>
            <div className="flex w-full max-w-md flex-col gap-6 self-center p-6 pb-12">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Total balance</h3>
                <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <span className="text-lg font-bold">Σ</span>
                    </div>
                    <span className="text-xl font-semibold">{formatBalance(ergBalance || "0")} ERG</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Token balances</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <GauIcon className="h-6 w-6" />
                      <div>
                        <p className="text-xs text-muted-foreground">GAU</p>
                        <p className="text-lg font-semibold">{formatBalance(gauBalance)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <GaucIcon className="h-6 w-6" />
                      <div>
                        <p className="text-xs text-muted-foreground">GAUC</p>
                        <p className="text-lg font-semibold">{formatBalance(gaucBalance)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Active address</h3>
                <div className="group relative rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm break-all">
                      {ergoAddress}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleDisconnect}
                variant="default"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Disconnect wallet
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  if (ergoPayAddress) {
    return (
      <>
        <Button variant="outline" className="gap-2" onClick={() => setShowErgoPayDrawer(true)}>
          <WalletIcon className="h-4 w-4" />
          {`${ergoPayAddress.slice(0, 4)}...${ergoPayAddress.slice(-4)}`}
        </Button>
        <Drawer open={showErgoPayDrawer} onOpenChange={setShowErgoPayDrawer}>
          <DrawerContent className="z-[9999]">
            <DrawerHeader>
              <DrawerTitle className="text-center text-xl text-primary">ErgoPay</DrawerTitle>
            </DrawerHeader>
            <div className="flex w-full max-w-md flex-col gap-6 self-center p-6 pb-12">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Total balance</h3>
                <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <span className="text-lg font-bold">Σ</span>
                    </div>
                    <span className="text-xl font-semibold">{formatBalance(ergoPayBalances.erg)} ERG</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Token balances</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <GauIcon className="h-6 w-6" />
                      <div>
                        <p className="text-xs text-muted-foreground">GAU</p>
                        <p className="text-lg font-semibold">{formatBalance(ergoPayBalances.gau)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <GaucIcon className="h-6 w-6" />
                      <div>
                        <p className="text-xs text-muted-foreground">GAUC</p>
                        <p className="text-lg font-semibold">{formatBalance(ergoPayBalances.gauc)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-primary">Active address</h3>
                <div className="group relative rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm break-all">
                      {ergoPayAddress}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleErgoPayDisconnect}
                variant="default"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Disconnect wallet
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
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
              <TabsTrigger value="ergopay">
                Ergo Pay
              </TabsTrigger>
            </TabsList>
            <TabsContent value="browser" className="min-h-[240px]">
              {!isInitialized ? (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground min-h-[240px]">
                  <p className="w-60 text-center">Loading wallets...</p>
                </div>
              ) : walletList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground min-h-[240px]">
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
                <div className="flex flex-col gap-2 min-h-[240px] py-4">
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
            <TabsContent value="ergopay" className="min-h-[240px]">
              <div className="flex flex-col justify-center p-4 min-h-[240px]">
                <Button
                  onClick={() => {
                    setShowErgoPayModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full"
                >
                  Open ErgoPay QR Code
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
      <ErgoPayQRModal isOpen={showErgoPayModal} onClose={() => setShowErgoPayModal(false)} onAddressReceived={handleErgoPayAddress} />
    </Drawer>
  );
}
