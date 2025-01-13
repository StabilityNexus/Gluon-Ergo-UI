"use client"

import { Card } from "@/lib/components/ui/card"
import { useErgo } from "@/lib/providers/ErgoProvider"
import { useState } from "react"

interface MyStats {
  ergBalance: number
  usdBalance: number
  gauBalance: number
  gaucBalance: number
}

export function MyStats() {
  const { isConnected } = useErgo()
  const [stats, setStats] = useState<MyStats>({
    ergBalance: 935,
    usdBalance: 93604.40,
    gauBalance: 6,
    gaucBalance: 23
  })

  return (
    <div className="flex flex-col gap-6 w-full pt-8">
      <Card className="w-full rounded-t-[3rem] bg-gradient-to-t dark:from-[#1C1C1C] dark:from-30% dark:via-black dark:to-black from-slate-200 to-white/50 p-8 space-y-6">
        {/* Title */}
        <h2 className="text-5xl font-bold mb-6 mt-8">My Holdings</h2>
        
        {isConnected ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 h-[200px]">
              {/* USD Balance - spans 2 columns */}
              <Card className="col-span-2 bg-gradient-to-b dark:from-[#1C1C1C] dark:from-6% dark:via-black dark:to-black rounded-xl p-6 flex flex-col justify-center items-start w-full">
                <div className="text-xs text-muted-foreground">
                  ERG: {stats.ergBalance}
                </div>
                <div className="text-6xl font-bold mt-2">
                  {stats.usdBalance.toLocaleString(undefined, { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })} <span className="text-sm text-muted-foreground">USD</span>
                </div>
              </Card>

              {/* GAU Balance */}
              <Card className="dark:bg-gradient-to-b dark:from-yellow-900/15 dark:to-black/50 rounded-xl p-6 flex flex-col justify-center items-center w-full">
                <div className="text-5xl font-bold">
                  {stats.gauBalance}k
                </div>
                <div className="text-sm text-muted-foreground">
                  GAU
                </div>
              </Card>

              {/* GAUC Balance */}
              <Card className="dark:bg-gradient-to-b dark:from-red-900/15 to-black/50 rounded-xl p-6 flex flex-col justify-center items-center w-full">
                <div className="text-5xl font-bold">
                  {stats.gaucBalance}m
                </div>
                <div className="text-sm text-muted-foreground">
                  GAUc
                </div>
              </Card>
            </div>

            {/* Transactions Card */}
            <Card className="w-full bg-background rounded-t-[3rem] p-6">
              <h3 className="text-3xl font-bold mt-4 mb-8">Transactions</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                  <div>
                    <div className="font-medium">Swap ERG to GAU</div>
                    <div className="text-sm text-muted-foreground">March 10, 2024</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">100 ERG</div>
                    <div className="text-sm text-muted-foreground">$164.00</div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                  <div>
                    <div className="font-medium">Mint GAUc</div>
                    <div className="text-sm text-muted-foreground">March 9, 2024</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">50 GAUc</div>
                    <div className="text-sm text-muted-foreground">$82.00</div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                  <div>
                    <div className="font-medium">Burn GAU</div>
                    <div className="text-sm text-muted-foreground">March 8, 2024</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">25 GAU</div>
                    <div className="text-sm text-muted-foreground">$41.00</div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-lg text-muted-foreground">Connect your wallet to view your stats</p>
          </div>
        )}
      </Card>
    </div>
  )
}