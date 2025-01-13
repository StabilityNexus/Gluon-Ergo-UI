"use client"

import { useEffect, useState } from "react"
import { Card } from "@/lib/components/ui/card"
import { Button } from "@/lib/components/ui/button"
import { Skeleton } from "@/lib/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/lib/components/ui/tooltip"
import { nanoErgsToErgs } from "@/lib/utils/erg-converter"
import { Coins, Scale, BarChart3, Percent } from "lucide-react"
import { cn } from "@/lib/utils/utils"
import { useRouter } from "next/navigation"

interface GluonStats {
  ergPrice: number | null
  goldKgPrice: number | null
  gauPrice: number | null
  gaucPrice: number | null
  reserveRatio: number | null
  tvl: number | null
}

const initialStats: GluonStats = {
  ergPrice: null,
  goldKgPrice: null,
  gauPrice: null,
  gaucPrice: null,
  reserveRatio: null,
  tvl: null
}

export function GluonStats() {
  const [stats, setStats] = useState<GluonStats>(initialStats)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchStats() {
      try {
        const [ergPriceRes, sdk] = await Promise.all([
          fetch('/api/getErgPrice'),
          import('gluon-gold-sdk')
        ])

        const { price: ergPrice } = await ergPriceRes.json()
        const gluon = new sdk.Gluon()
        const gluonBox = await gluon.getGluonBox()
        const oracleBox = await gluon.getGoldOracleBox()

        const [gaucPrice, goldKgPrice, reserveRatio, tvl] = await Promise.all([
          gluonBox.protonPrice(oracleBox),
          oracleBox.getPrice(),
          gluon.getReserveRatio(gluonBox, oracleBox),
          gluon.getTVL(gluonBox, oracleBox)
        ])

        setStats({
          ergPrice,
          goldKgPrice: nanoErgsToErgs(goldKgPrice),
          gauPrice: nanoErgsToErgs(goldKgPrice) / 1000, // Convert from kg to gram
          gaucPrice: nanoErgsToErgs(gaucPrice),
          reserveRatio,
          tvl: nanoErgsToErgs(tvl)
        })
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const tokenCards = [
    {
      title: "ERG/KG",
      subtitle: "Oracle Gold Price",
      value: stats.goldKgPrice,
      icon: <Scale className="h-5 w-5 text-yellow-700" />,
      tooltip: "Current gold price per kilogram in ERG"
    },
    {
      title: "GAU",
      subtitle: "Gold-Pegged Token",
      value: stats.gauPrice,
      icon: <Coins className="h-5 w-5 text-yellow-400" />,
      tooltip: "GAU is pegged 1:1 to a gram of gold"
    },
    {
      title: "GAUC",
      subtitle: "Collateral Token",
      value: stats.gaucPrice,
      icon: <Coins className="h-5 w-5 text-red-400" />,
      tooltip: "GAUC is the collateral token used to maintain the GAU peg"
    }
  ]

  return (
    <div className="flex gap-6 h-[288px] w-full">
      {/* Left Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-5xl font-bold">Gluon Stats</h2>
          <div className='border px-3 py-1 rounded-xl text-sm'>
            <span className="text-muted-foreground">Erg Price: </span>
            <span>{stats.ergPrice?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-muted-foreground text-xs pl-1">USD</span>
          </div>
        </div>
  
        {/* Token Grid */}
        <div className="mt-auto grid grid-cols-3 gap-4 flex-1">
          {/* Oracle Gold Price */}
          <Card className={cn(
            " p-6 flex flex-col justify-between",
            "rounded-xl"
          )}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-yellow-700" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Oracle Gold Price</span>
                <span className="font-medium">Gold/KG</span>
              </div>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="text-4xl font-bold text-center">
                {stats.goldKgPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">ERG/kg</div>
            </div>
          </Card>
  
          {/* GAU Token */}
          <Card className={cn(
            "p-6 flex flex-col justify-between",
            "rounded-xl"
          )}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-yellow-400" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Gold Pegged Token</span>
                <span className="font-medium">GAU</span>
              </div>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="text-4xl font-bold">
                {stats.gauPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">ERG</div>
            </div>
          </Card>
  
          {/* GAUC Token */}
          <Card className={cn(
            " p-6 flex flex-col justify-between",
            "rounded-xl"
          )}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-red-400" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Collateral Token</span>
                <span className="font-medium">GAUC</span>
              </div>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="text-4xl font-bold">
                {stats.gaucPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">ERG</div>
            </div>
          </Card>
        </div>
      </div>
  
      {/* Right Card */}
      <Card className="w-[320px] h-full items-center bg-gradient-to-t dark:from-amber-950/40 dark:to-black/50 from-slate-300 to-gray-500/10 p-6 flex flex-col">
        <div className="flex-1 space-y-6 items-center justify-center">
          <div>
            <div className="text-4xl font-bold text-center">
              {stats.reserveRatio?.toFixed(0)}%
            </div>
            <div className=" font-medium text-sm text-muted-foreground text-center">
              Current Reserve Ratio
            </div>
          </div>
  
          <div>
            <div className="text-4xl font-bold text-center">
              {stats.tvl?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm font-medium text-muted-foreground text-center">
              Total Value Locked
            </div>
          </div>
        </div>
  
        <Button 
          size="lg" 
          className="w-[50%] text-white dark:bg-amber-800 dark:hover:bg-amber-700"
          onClick={() => router.push('/reactor/swap')}
        >
          Swap Now
        </Button>
      </Card>
    </div>
  )
}