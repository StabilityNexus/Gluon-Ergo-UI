"use client"

import { Card } from "@/lib/components/ui/card"
import { Skeleton } from "@/lib/components/ui/skeleton"
import { useErgo } from "@/lib/providers/ErgoProvider"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wallet, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils/utils"
import { nanoErgsToErgs, convertFromDecimals, formatMicroNumber } from "@/lib/utils/erg-converter"
import { TOKEN_ADDRESS } from '@/lib/constants/token'
import BigNumber from "bignumber.js"
import ErgIcon from "@/lib/components/icons/ErgIcon"
import GauIcon from "@/lib/components/icons/GauIcon"
import GaucIcon from "@/lib/components/icons/GaucIcon"

interface WalletStats {
  ergBalance: string
  ergBalanceUSD: number
  gauBalance: string
  gauBalanceUSD: number
  gaucBalance: string
  gaucBalanceUSD: number
  totalPortfolioValue: number
  ergPrice: number | null
  gauPrice: BigNumber | null
  gaucPrice: BigNumber | null
}

const initialStats: WalletStats = {
  ergBalance: "0",
  ergBalanceUSD: 0,
  gauBalance: "0",
  gauBalanceUSD: 0,
  gaucBalance: "0",
  gaucBalanceUSD: 0,
  totalPortfolioValue: 0,
  ergPrice: null,
  gauPrice: null,
  gaucPrice: null
}

export function MyStats() {
  const { isConnected, getBalance } = useErgo()
  const [stats, setStats] = useState<WalletStats>(initialStats)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const fetchWalletStats = async () => {
      if (!isConnected) {
        setStats(initialStats)
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        // Fetch ERG price, wallet balances, and protocol prices in parallel
        const [ergPriceRes, balances, sdk] = await Promise.all([
          fetch('/api/getErgPrice').catch(() => ({ json: () => ({ price: null }) })),
          getBalance(),
          import('gluon-gold-sdk')
        ])

        const { price: ergPrice } = await ergPriceRes.json()

        // Get protocol prices for GAU/GAUC
        const gluon = new sdk.Gluon()
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || 'testnet'
        const gluonBox = await gluon.getGluonBox()
        const oracleBox = await gluon.getGoldOracleBox()

        const [gaucPrice, goldKgPrice] = await Promise.all([
          gluonBox.protonPrice(oracleBox),
          oracleBox.getPrice()
        ])

        // Convert protocol prices to ERG
        const gaucPriceERG = nanoErgsToErgs(gaucPrice)
        const goldKgPriceERG = nanoErgsToErgs(goldKgPrice)
        const gauPriceERG = goldKgPriceERG.dividedBy(1000) // Convert kg to gram

        // Process wallet balances
        const ergBalanceData = balances.find((b: any) => b.tokenId === 'ERG' || !b.tokenId)
        const gauBalanceData = balances.find((b: any) => b.tokenId === TOKEN_ADDRESS.gau)
        const gaucBalanceData = balances.find((b: any) => b.tokenId === TOKEN_ADDRESS.gauc)

        // Convert balances to readable format
        const ergRawBalance = ergBalanceData?.balance ? BigInt(ergBalanceData.balance) : BigInt(0)
        const ergBalance = nanoErgsToErgs(ergRawBalance)

        const gauRawBalance = gauBalanceData?.balance ? BigInt(gauBalanceData.balance) : BigInt(0)
        const gauBalance = convertFromDecimals(gauRawBalance)

        const gaucRawBalance = gaucBalanceData?.balance ? BigInt(gaucBalanceData.balance) : BigInt(0)
        const gaucBalance = convertFromDecimals(gaucRawBalance)

        // Calculate USD values
        const ergBalanceUSD = ergPrice ? ergBalance.multipliedBy(ergPrice).toNumber() : 0
        const gauBalanceUSD = ergPrice ? gauBalance.multipliedBy(gauPriceERG).multipliedBy(ergPrice).toNumber() : 0
        const gaucBalanceUSD = ergPrice ? gaucBalance.multipliedBy(gaucPriceERG).multipliedBy(ergPrice).toNumber() : 0
        const totalPortfolioValue = ergBalanceUSD + gauBalanceUSD + gaucBalanceUSD

        setStats({
          ergBalance: ergBalance.toFixed(4),
          ergBalanceUSD,
          gauBalance: formatMicroNumber(gauBalance).display,
          gauBalanceUSD,
          gaucBalance: formatMicroNumber(gaucBalance).display,
          gaucBalanceUSD,
          totalPortfolioValue,
          ergPrice,
          gauPrice: gauPriceERG,
          gaucPrice: gaucPriceERG
        })

        // Log real wallet data for development
        console.log("💼 Real Wallet Data:", {
          balances: {
            erg: { amount: ergBalance.toNumber(), usd: ergBalanceUSD },
            gau: { amount: gauBalance.toNumber(), usd: gauBalanceUSD },
            gauc: { amount: gaucBalance.toNumber(), usd: gaucBalanceUSD }
          },
          prices: {
            erg: ergPrice,
            gau: gauPriceERG.toNumber(),
            gauc: gaucPriceERG.toNumber()
          },
          portfolio: {
            total: totalPortfolioValue,
            breakdown: {
              ergPercent: (ergBalanceUSD / totalPortfolioValue * 100).toFixed(1),
              gauPercent: (gauBalanceUSD / totalPortfolioValue * 100).toFixed(1),
              gaucPercent: (gaucBalanceUSD / totalPortfolioValue * 100).toFixed(1)
            }
          }
        })

      } catch (error) {
        console.error("Error fetching wallet stats:", error)
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchWalletStats()

    // Set up less frequent polling for connected wallets - every 2 minutes
    if (isConnected) {
      const interval = setInterval(fetchWalletStats, 2 * 60 * 1000) // 2 minutes
      return () => clearInterval(interval)
    }
  }, [isConnected, getBalance])

  const formatBalance = (balance: string, decimals: number = 4) => {
    const num = parseFloat(balance)
    if (num === 0) return "0"

    // For very small numbers, show at least 2 significant digits
    if (num < 0.01 && num > 0) {
      const str = num.toString()
      const firstNonZero = str.search(/[1-9]/)
      if (firstNonZero > 0) {
        // Show at least 2 significant digits after first non-zero
        const significantDecimals = Math.max(2, firstNonZero + 1)
        return num.toFixed(Math.min(significantDecimals, 8))
      }
    }

    if (num < 0.0001) return "<0.0001"

    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    })
  }

  const formatUSD = (usd: number) => {
    if (usd === 0) return "$0"
    if (usd < 0.01) return "<$0.01"
    return `$${usd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const renderTokenBalance = (
    token: 'ERG' | 'GAU' | 'GAUC',
    balance: string,
    usdValue: number,
    delay: number = 0
  ) => {
    const getTokenInfo = () => {
      switch (token) {
        case 'ERG':
          return {
            icon: <ErgIcon className="w-7 h-7" />,
            name: 'ERG',
            symbol: 'ERG',
            fullName: 'Ergo'
          }
        case 'GAU':
          return {
            icon: <GauIcon className="w-7 h-7" />,
            name: 'GAU',
            symbol: 'GAU',
            fullName: 'Gold-Pegged Stablecoin'
          }
        case 'GAUC':
          return {
            icon: <GaucIcon className="w-7 h-7" />,
            name: 'GAUC',
            symbol: 'GAUC',
            fullName: 'Leveraged Yield Token'
          }
      }
    }

    const tokenInfo = getTokenInfo()

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3, ease: "easeOut" }}
        whileHover={{ scale: 1.01, y: -2 }}
        className="w-full"
      >
        <Card className="p-6 bg-card border-border hover:shadow-md dark:hover:shadow-lg transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3"
            >
              {tokenInfo.icon}
              <div>
                <div className="font-semibold text-foreground">{tokenInfo.symbol}</div>
                <div className="text-xs text-muted-foreground">{tokenInfo.fullName}</div>
              </div>
            </motion.div>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <motion.div
                  key={balance}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-2xl font-bold text-foreground"
                >
                  {formatBalance(balance, token === 'ERG' ? 4 : 6)}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <motion.div
                  key={usdValue}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {formatUSD(usdValue)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>
    )
  }

  if (!isConnected) {
    return (
      <motion.div
        className="flex flex-col gap-6 w-full pt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-full rounded-2xl bg-card border-border p-8">
          <h2 className="text-3xl md:text-5xl font-bold mb-8 mt-4 text-foreground">My Holdings</h2>

          <motion.div
            className="flex flex-col items-center justify-center h-[200px] space-y-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Wallet className="h-16 w-16 text-muted-foreground" />
            </motion.div>
            <p className="text-lg text-muted-foreground text-center">
              Connect your wallet to view your holdings
            </p>
          </motion.div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="flex flex-col gap-6 w-full pt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-full rounded-2xl bg-card border border-border p-6 md:p-8 space-y-6 md:space-y-8">
        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div className="flex items-center gap-4">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground">My Holdings</h2>
            {isLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-6 w-6 text-muted-foreground" />
              </motion.div>
            )}
          </div>

          {hasError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-red-500"
            >
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">Error loading data</span>
            </motion.div>
          )}
        </motion.div>

        {/* Portfolio Overview - No Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-border/50"
        >
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Total Portfolio Value
            </div>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <Skeleton className="h-16 w-48" />
              ) : (
                <motion.div
                  key={stats.totalPortfolioValue}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-5xl md:text-6xl font-bold text-foreground"
                >
                  {formatUSD(stats.totalPortfolioValue)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Token Balances Grid - Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {renderTokenBalance('GAU', stats.gauBalance, stats.gauBalanceUSD, 0.2)}
            {renderTokenBalance('GAUC', stats.gaucBalance, stats.gaucBalanceUSD, 0.3)}
            {renderTokenBalance('ERG', stats.ergBalance, stats.ergBalanceUSD, 0.1)}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}