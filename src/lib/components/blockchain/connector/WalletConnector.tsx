"use client"

import { Button } from "@/lib/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/lib/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/lib/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/lib/components/ui/tabs"
import { useErgo } from "@/lib/providers/ErgoProvider"
import { WalletIcon, LogOut, BadgeCheck, ArrowUpRight } from "lucide-react"
import { useEffect, useState } from "react"


export function WalletConnector() {
  const { walletList, isConnected, connect, disconnect, getChangeAddress, getBalance  } = useErgo()
  const [isOpen, setIsOpen] = useState(false)
  const [ergoAddress, setErgoAddress] = useState<string | null>(null)
  const [ergBalance, setErgoBalance] = useState<string | null>('0')

  useEffect(() => {
    const savedWallet = localStorage.getItem("connectedWallet")
    if (savedWallet) {
      connect(savedWallet)
        .then(async (success) => {
          if (success) {
            const address = await getChangeAddress()
            setErgoAddress(address)
            const ergoTokens = await getBalance()
            const ergBalance = ergoTokens.find(item => item.tokenId === "ERG")
            if (ergBalance) {
              const balance = (parseInt(ergBalance.balance) / 1000000000)
              setErgoBalance(balance.toString())
            }
          }
        })
        .catch(console.error)
    }
  }, [connect, isConnected, getChangeAddress, getBalance])


  const handleConnect = async (walletName: string) => {
    try {
      console.log("Attempting to connect to wallet:", walletName)
      
      if (!window.ergoConnector) {
        console.error("Ergo connector not found. Is Nautilus installed?")
        return
      }

      const success = await connect(walletName)
      console.log("Connection result:", success)

      const address = await getChangeAddress()
      console.log(address)
      setErgoAddress(address)
      const balance = await getBalance()
      console.log("Reconnected balance:", balance)
      setErgoBalance(balance)
      if (success) {
        localStorage.setItem("connectedWallet", walletName)
        setIsOpen(false)
      }
    } catch (error) {
      console.error("Failed to connect:", error)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    localStorage.removeItem("connectedWallet")
    setErgoAddress(null)
    setErgoBalance(null)
  }

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
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={handleDisconnect}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="gap-2">
          <WalletIcon className="h-4 w-4" />
          Connect Wallet
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-center text-xl">Connect your wallet</DrawerTitle>
        </DrawerHeader>
        <div className="flex p-4 self-center w-[460px] pb-12">
          <Tabs defaultValue="browser" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browser">Browser Wallet</TabsTrigger>
              <TabsTrigger value="ergopay" disabled>
                Ergo Pay 
              </TabsTrigger>
            </TabsList>
            <TabsContent value="browser">
  {walletList.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
      <p className="text-center w-60">No Ergo wallets installed, learn how to setup your Nautilus Wallet</p>
      
      <Button
        variant='ghost'
        className="mt-2 hover:bg-white hover:text-black border shadow-sm"
        onClick={() => window.open('https://ergoplatform.org/en/blog/2022-03-10-storing-crypto-on-ergo-nautilus-wallet/', '_blank')}
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
          className="w-full justify-start gap-2 mt-3"
          onClick={() => handleConnect(wallet.connectName)}
        >
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="h-6 w-6"
          />
          {wallet.name}
        </Button>
      ))}
    </div>
  )}
</TabsContent>
            <TabsContent value="ergopay">
              <div className="text-center p-4 text-muted-foreground">
                Ergo Pay here
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  )
}