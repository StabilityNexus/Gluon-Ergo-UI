"use client"

import { Button } from "@/lib/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/lib/components/ui/card"
import { Input } from "@/lib/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/components/ui/select"
import { Separator } from "@/lib/components/ui/separator"
import { Settings2 } from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils/utils"
import { useErgo } from "@/lib/providers/ErgoProvider"
import { NumericFormat } from 'react-number-format'
import { NodeService } from "@/lib/utils/nodeService"
import { TOKEN_ADDRESS } from '@/lib/constants/token'
import { convertFromDecimals, formatMicroNumber, nanoErgsToErgs, ergsToNanoErgs, convertToDecimals } from '@/lib/utils/erg-converter'
import BigNumber from 'bignumber.js'
import { Token, TokenSymbol, ReceiptDetails } from '@/lib/functions/reactor/types'
import { defaultTokens, getValidToTokens, getActionType, getDescription, getTitle, validateAmount, formatValue } from '@/lib/functions/reactor/utils'
import { calculateFissionAmounts, handleFissionSwap } from '@/lib/functions/reactor/handleFission'
import { calculateFusionAmounts, handleFusionSwap } from '@/lib/functions/reactor/handleFusion'

const formatTokenAmount = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (!numValue) return '0'

  // Convert to string and remove trailing zeros after decimal
  const str = numValue.toString()

  // If it's scientific notation, convert to regular number first
  if (str.includes('e')) {
    const [mantissa, exponent] = str.split('e')
    const exp = parseInt(exponent)
    if (exp < 0) {
      const absExp = Math.abs(exp)
      return '0.' + '0'.repeat(absExp - 1) + mantissa.replace('.', '')
    }
  }

  // For regular numbers
  if (str.includes('.')) {
    // Split into whole and decimal parts
    const [whole, decimal] = str.split('.')
    if (!decimal) return whole

    // Trim trailing zeros but keep 4 significant digits for decimals
    const trimmed = decimal.replace(/0+$/, '')
    if (!trimmed) return whole

    // Keep only first 4 significant digits for readability
    // but don't round - just truncate
    const significant = trimmed.slice(0, 4)
    return `${whole}.${significant}`
  }

  return str
}

export function ReactorSwap() {
  const { isConnected, getBalance, getUtxos, ergoWallet } = useErgo()
  const [tokens, setTokens] = useState<Token[]>(defaultTokens)
  const [fromToken, setFromToken] = useState<Token>(tokens[0])
  const [toToken, setToToken] = useState<Token>(tokens[3])
  const [fromAmount, setFromAmount] = useState<string>("0")
  const [toAmount, setToAmount] = useState<string>("0")
  const [gauAmount, setGauAmount] = useState<string>("0")
  const [gaucAmount, setGaucAmount] = useState<string>("0")
  const [isLoading, setIsLoading] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [gluonInstance, setGluonInstance] = useState<any>(null)
  const [gluonBox, setGluonBox] = useState<any>(null)
  const [oracleBox, setOracleBox] = useState<any>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [nodeService] = useState(() => new NodeService(process.env.NEXT_PUBLIC_NODE || ''))
  const [balanceUpdateTrigger, setBalanceUpdateTrigger] = useState(0)
  const [totalFee, setTotalFee] = useState(0)
  const [boxesReady, setBoxesReady] = useState(false)
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetails>({
    inputAmount: 0,
    outputAmount: { gau: 0, gauc: 0, erg: 0 },
    fees: {
      devFee: 0,
      uiFee: 0,
      minerFee: 0,
      totalFee: 0
    }
  })
  const [maxErgOutput, setMaxErgOutput] = useState<string>("0")

  const [debouncedCalculation] = useState(() => {
    let timeoutId: NodeJS.Timeout
    return (value: string, isFromInput: boolean) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (!value || value === "0" || value === ".") {
          // Reset values for empty input
          if (isFromInput) {
            setToAmount("0")
            setGauAmount("0")
            setGaucAmount("0")
          } else {
            setGauAmount("0")
            setGaucAmount("0")
          }
          setReceiptDetails({
            inputAmount: 0,
            outputAmount: { gau: 0, gauc: 0, erg: 0 },
            fees: { devFee: 0, uiFee: 0, minerFee: 0, totalFee: 0 },
            maxErgOutput: maxErgOutput
          })
          return
        }

        try {
          await calculateAmounts(value, isFromInput)
        } catch (error) {
          console.error("Error in debounced calculation:", error)
        }
      }, 300)
    }
  })

  // Initialize Gluon SDK
  useEffect(() => {
    const initGluon = async () => {
      setIsInitializing(true)
      setBoxesReady(false)
      setInitError(null)
      try {
        const sdk = await import('gluon-gold-sdk')
        const gluon = new sdk.Gluon()

        // Update only the network in the default config
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || 'testnet'
        setGluonInstance(gluon)

        // Get initial boxes
        const gBox = await gluon.getGluonBox()
        const oBox = await gluon.getGoldOracleBox()

        if (!gBox || !oBox) {
          throw new Error("Failed to initialize Gluon boxes")
        }

        setGluonBox(gBox)
        setOracleBox(oBox)
        setBoxesReady(true)

        console.log("Gluon initialized:", {
          network: gluon.config.NETWORK,
          gluonBox: gBox,
          oracleBox: oBox
        })
      } catch (error) {
        console.error("Failed to initialize Gluon:", error)
        setInitError("Failed to initialize Gluon. Please try again later.")
        setBoxesReady(false)
      } finally {
        setIsInitializing(false)
      }
    }

    initGluon()

    // Refresh boxes every 30 seconds
    const boxRefreshInterval = setInterval(() => {
      if (gluonInstance) {
        initGluon()
      }
    }, 30000)

    return () => clearInterval(boxRefreshInterval)
  }, [])

  useEffect(() => {
    const updateBalances = async () => {
      console.log("Connection status:", isConnected)
      if (isConnected) {
        try {
          const balances = await getBalance()
          console.log("Raw balances from wallet:", balances)

          // Create a new array to store updated tokens
          let updatedTokens = [...tokens]

          if (Array.isArray(balances) && balances.length > 0) {
            // Handle ERG balance (always first token)
            const ergBalance = balances[0]
            if (ergBalance && ergBalance.balance) {
              const ergAmount = (parseInt(ergBalance.balance) / 1000000000).toFixed(2)
              updatedTokens = updatedTokens.map(token =>
                token.symbol === "ERG" ? { ...token, balance: ergAmount } : token
              )
            }

            // Handle GAU and GAUC tokens
            balances.forEach(token => {
              if (token.tokenId === TOKEN_ADDRESS.gau) {
                const gauBalance = convertFromDecimals(BigInt(token.balance))
                updatedTokens = updatedTokens.map(t =>
                  t.symbol === "GAU" ? { ...t, balance: formatMicroNumber(gauBalance).display } : t
                )
              } else if (token.tokenId === TOKEN_ADDRESS.gauc) {
                const gaucBalance = convertFromDecimals(BigInt(token.balance))
                updatedTokens = updatedTokens.map(t =>
                  t.symbol === "GAUC" ? { ...t, balance: formatMicroNumber(gaucBalance).display } : t
                )
              }
            })

            // Update GAU-GAUC pair balance (minimum of GAU and GAUC)
            const gauToken = updatedTokens.find(t => t.symbol === "GAU")
            const gaucToken = updatedTokens.find(t => t.symbol === "GAUC")
            if (gauToken && gaucToken) {
              const gauBalance = parseFloat(gauToken.balance)
              const gaucBalance = parseFloat(gaucToken.balance)
              const pairBalance = Math.min(gauBalance, gaucBalance).toFixed(2)
              updatedTokens = updatedTokens.map(t =>
                t.symbol === "GAU-GAUC" ? { ...t, balance: pairBalance } : t
              )
            }
          }

          setTokens(updatedTokens)

          // Update fromToken if it's currently selected
          const currentSymbol = fromToken.symbol
          const updatedToken = updatedTokens.find(t => t.symbol === currentSymbol)
          if (updatedToken) {
            setFromToken(updatedToken)
          }

        } catch (error) {
          console.error("Error fetching balances:", error)
        }
      } else {
        // Reset tokens to default state when disconnected
        setTokens(defaultTokens)
        setFromToken(defaultTokens[0])
        setToToken(defaultTokens[3])
      }
    }

    updateBalances()
    const pollingInterval = setInterval(updateBalances, 30000)

    return () => clearInterval(pollingInterval)
  }, [isConnected, getBalance, fromToken.symbol, balanceUpdateTrigger])

  const handleFromTokenChange = (symbol: string) => {
    const newToken = tokens.find(t => t.symbol === symbol as TokenSymbol)
    if (!newToken) return

    setFromToken(newToken)
    const validToTokens = getValidToTokens(newToken.symbol, tokens)
    if (!validToTokens.find(t => t.symbol === toToken.symbol)) {
      setToToken(validToTokens[0])
    }
  }

  const handleToTokenChange = (symbol: string) => {
    const newToken = tokens.find(t => t.symbol === symbol as TokenSymbol)
    if (!newToken) return

    const validToTokens = getValidToTokens(fromToken.symbol, tokens)
    if (validToTokens.find(t => t.symbol === newToken.symbol)) {
      setToToken(newToken)
    }
  }

  const handleSwapTokens = () => {
    const validToTokens = getValidToTokens(toToken.symbol, tokens)
    if (validToTokens.find(t => t.symbol === fromToken.symbol)) {
      const temp = fromToken
      setFromToken(toToken)
      setToToken(temp)
      // Swap amounts
      const tempAmount = fromAmount
      setFromAmount(toAmount)
      setToAmount(tempAmount)
    }
  }

  const handleAmountChange = (value: string, isFromInput: boolean) => {
    // Clean the input value
    let cleanValue = value.replace(/[^\d.]/g, '')
    // Only allow one decimal point
    const parts = cleanValue.split('.')
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('')
    }

    // For ERG input (fission), validate against balance
    if (fromToken.symbol === "ERG" && isFromInput) {
      const numValue = parseFloat(cleanValue || '0')
      const balance = parseFloat(fromToken.balance)
      // Leave 0.1 ERG for fees
      const maxAllowed = Math.max(0, balance - 0.1)

      if (numValue > maxAllowed) {
        cleanValue = maxAllowed.toString()
      }
    }

    // Always update the UI immediately with the cleaned value
    if (isFromInput) {
      setFromAmount(cleanValue)
    } else {
      setToAmount(cleanValue)
    }

    // Trigger calculation if we have a valid number
    const numValue = parseFloat(cleanValue)
    if (!isNaN(numValue)) {
      // Remove the debounce for direct calculation
      calculateAmounts(cleanValue, isFromInput).catch(console.error)
    } else {
      // Reset dependent values if input is invalid
      if (isFromInput) {
        setToAmount("0")
        setGauAmount("0")
        setGaucAmount("0")
      } else {
        setGauAmount("0")
        setGaucAmount("0")
      }
      setReceiptDetails({
        inputAmount: 0,
        outputAmount: { gau: 0, gauc: 0, erg: 0 },
        fees: { devFee: 0, uiFee: 0, minerFee: 0, totalFee: 0 },
        maxErgOutput: maxErgOutput
      })
    }
  }

  const handleMax = async (isFrom: boolean) => {
    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      // For fusion, use the maximum available GAU/GAUC
      const gauBalance = tokens.find(t => t.symbol === "GAU")?.balance || "0"
      const gaucBalance = tokens.find(t => t.symbol === "GAUC")?.balance || "0"

      setGauAmount(gauBalance)
      setGaucAmount(gaucBalance)
      setFromAmount(Math.min(parseFloat(gauBalance), parseFloat(gaucBalance)).toString())

      // Calculate the ERG output for these amounts
      const result = await calculateFusionAmounts({
        gluonInstance,
        gluonBox,
        value: maxErgOutput,
        gauBalance,
        gaucBalance
      })

      if (!('error' in result)) {
        setToAmount(result.toAmount)
        setReceiptDetails(result.receiptDetails)
      }
      return
    }

    // Handle other cases...
    const relevantToken = isFrom ? fromToken : toToken
    const balance = parseFloat(relevantToken.balance)

    if (isFrom) {
      if (relevantToken.symbol === "ERG") {
        const balanceWithFeeBuffer = Math.max(0, balance - 0.1)
        const formattedBalance = balanceWithFeeBuffer.toFixed(4)
        setFromAmount(formattedBalance)
        calculateAmounts(formattedBalance, true).catch(console.error)
      }
    }
  }

  const calculateAmounts = async (value: string, isFromInput: boolean) => {
    if (!boxesReady || !gluonInstance || !gluonBox) {
      console.log("Boxes not ready for calculation")
      return
    }

    setIsCalculating(true)
    try {
      if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
        const gauBalance = tokens.find(t => t.symbol === "GAU")?.balance || "0"
        const gaucBalance = tokens.find(t => t.symbol === "GAUC")?.balance || "0"

        // For fusion mode, calculate based on desired ERG output
        const result = await calculateFusionAmounts({
          gluonInstance,
          gluonBox,
          value: value,
          gauBalance,
          gaucBalance
        })

        if ('error' in result) {
          console.error(result.error)
          setToAmount("0")
          setGauAmount("0")
          setGaucAmount("0")
          setReceiptDetails({
            inputAmount: 0,
            outputAmount: { gau: 0, gauc: 0, erg: 0 },
            fees: { devFee: 0, uiFee: 0, minerFee: 0, totalFee: 0 },
            maxErgOutput: maxErgOutput
          })
          return
        }

        // Update all values
        setToAmount(result.toAmount)
        setGauAmount(result.gauAmount)
        setGaucAmount(result.gaucAmount)
        setReceiptDetails(result.receiptDetails)
      } else if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
        const result = await calculateFissionAmounts({
          gluonInstance,
          gluonBox,
          value
        })

        if ('error' in result) {
          console.error(result.error)
          if (result.resetValues) {
            if (result.resetValues.gauAmount) setGauAmount(result.resetValues.gauAmount)
            if (result.resetValues.gaucAmount) setGaucAmount(result.resetValues.gaucAmount)
          }
          return
        }

        setGauAmount(result.gauAmount)
        setGaucAmount(result.gaucAmount)
        setReceiptDetails(result.receiptDetails)
      }
    } finally {
      setIsCalculating(false)
    }
  }

  const handleSwap = async () => {
    if (!isConnected) {
      console.error("Please connect your wallet")
      return
    }

    if (isInitializing) {
      console.error("Gluon is still initializing")
      return
    }

    if (!gluonInstance || !gluonBox || !oracleBox) {
      console.error("Not ready for swap - Gluon initialization failed")
      return
    }

    setIsLoading(true)
    try {
      if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
        const result = await handleFissionSwap(
          gluonInstance,
          gluonBox,
          oracleBox,
          await getUtxos(),
          nodeService,
          ergoWallet,
          fromAmount
        )

        if (result.error) {
          throw new Error(result.error)
        }

        // Reset form
        setFromAmount("0")
        setGauAmount("0")
        setGaucAmount("0")

        // Trigger immediate balance update
        setBalanceUpdateTrigger(prev => prev + 1)
      } else if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
        // Fusion swap
        const result = await handleFusionSwap(
          gluonInstance,
          gluonBox,
          oracleBox,
          await getUtxos(),
          nodeService,
          ergoWallet,
          toAmount
        )

        if (result.error) {
          throw new Error(result.error)
        }

        // Reset form
        setFromAmount("0")
        setToAmount("0")

        // Trigger immediate balance update
        setBalanceUpdateTrigger(prev => prev + 1)
      }
    } catch (error) {
      console.error("Swap failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Add this effect to calculate max ERG output whenever relevant values change
  useEffect(() => {
    const calculateMaxErg = async () => {
      if (!boxesReady || !gluonInstance || !gluonBox) return

      try {
        const result = await calculateFusionAmounts({
          gluonInstance,
          gluonBox,
          value: "0",
          gauBalance: tokens.find(t => t.symbol === "GAU")?.balance || "0",
          gaucBalance: tokens.find(t => t.symbol === "GAUC")?.balance || "0"
        })

        if (!('error' in result)) {
          // Format to 2 decimal places for display
          const maxValue = parseFloat(result.maxErgOutput).toFixed(2)
          setMaxErgOutput(maxValue)
        }
      } catch (error) {
        console.error("Error calculating max ERG:", error)
      }
    }

    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      calculateMaxErg()
    }
  }, [boxesReady, gluonInstance, gluonBox, tokens, fromToken.symbol, toToken.symbol])

  const renderTokenCard = (isFrom: boolean) => (
    <div className="rounded-xl bg-gradient-to-r from-white/10 to-white/5 p-4 w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-muted-foreground">{isFrom ? "From" : "To"}</span>
        {/* Show balance for ERG in fission mode, and MAX to Fusion in fusion mode */}
        {fromToken.symbol === "ERG" && isFrom && (
          <span className="text-sm text-muted-foreground">
            Balance: {formatTokenAmount(fromToken.balance)} ERG
          </span>
        )}
        {fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG" && !isFrom && (
          <span className="text-sm text-muted-foreground">
            MAX to Fusion: {maxErgOutput} ERG
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-2">
        <Select
          value={isFrom ? fromToken.symbol : toToken.symbol}
          onValueChange={isFrom ? handleFromTokenChange : handleToTokenChange}
        >
          <SelectTrigger className={cn(
            "w-auto px-4",
            isFrom ? fromToken.color : toToken.color
          )}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(isFrom ? tokens : getValidToTokens(fromToken.symbol, tokens)).map((token) => (
              <SelectItem key={token.symbol} value={token.symbol}>
                {token.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(isFrom ? fromToken.symbol : toToken.symbol) !== "GAU-GAUC" && (
          <div className="flex items-center justify-end flex-1">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder="0"
              spellCheck="false"
              className={cn(
                "w-full text-right border-0 bg-transparent text-4xl font-bold focus-visible:ring-0 focus:outline-none",
                (!boxesReady || isCalculating) && "opacity-50 cursor-not-allowed"
              )}
              value={isFrom ? fromAmount : toAmount}
              onChange={(e) => {
                e.preventDefault()
                handleAmountChange(e.target.value, isFrom)
              }}
              onFocus={(e) => {
                e.target.select()
              }}
              disabled={!boxesReady || isCalculating}
            />
            {boxesReady && !isCalculating && (
              <button
                onClick={() => handleMax(isFrom)}
                className="font-semibold text-sm text-accent hover:text-accent/80 transition-colors ml-2"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>

      {(isFrom ? fromToken.symbol : toToken.symbol) === "GAU-GAUC" && (
        renderGauGaucCard(isFrom)
      )}
    </div>
  )

  const renderGauGaucCard = (isFrom: boolean) => (
    <div className="space-y-4 flex-1 w-full py-6">
      <div className="grid grid-cols-2 gap-8 px-8 justify-between">
        <div>
          <span className="text-sm text-muted-foreground block mb-2">
            Balance: {formatTokenAmount(tokens[1].balance)} GAU
          </span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{formatTokenAmount(gauAmount)}</span>
            <div className="px-1 py-0.5 rounded-lg font-bold text-xs bg-yellow-500">
              GAU
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div>
            <span className="text-sm text-muted-foreground block mb-2">
              Balance: {formatTokenAmount(tokens[2].balance)} GAUC
            </span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{formatTokenAmount(gaucAmount)}</span>
              <div className="px-1 py-0.5 rounded-lg font-bold text-xs bg-red-500">
                GAUC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const currentAction = getActionType(fromToken.symbol, toToken.symbol)

  // Fix the swap button disabled state
  const isSwapDisabled = () => {
    if (isLoading || !isConnected || !boxesReady || isCalculating) return true

    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      // For fusion mode
      const ergOutput = parseFloat(toAmount)
      const gauRequired = parseFloat(gauAmount)
      const gaucRequired = parseFloat(gaucAmount)
      const gauBalance = parseFloat(tokens.find(t => t.symbol === "GAU")?.balance || "0")
      const gaucBalance = parseFloat(tokens.find(t => t.symbol === "GAUC")?.balance || "0")

      // Check if we have valid amounts and sufficient balance
      if (isNaN(ergOutput) || ergOutput <= 0) return true
      if (isNaN(gauRequired) || gauRequired <= 0) return true
      if (isNaN(gaucRequired) || gaucRequired <= 0) return true
      if (gauRequired > gauBalance || gaucRequired > gaucBalance) return true

      // Check if output is within max limit
      const maxErg = parseFloat(maxErgOutput)
      if (ergOutput > maxErg) return true

      return false
    }

    if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
      // For fission mode
      const ergInput = parseFloat(fromAmount)
      const ergBalance = parseFloat(fromToken.balance)

      // Check if we have valid amount and sufficient balance
      if (isNaN(ergInput) || ergInput <= 0) return true
      if (ergInput > ergBalance) return true

      // Ensure we have enough ERG for fees (0.1 ERG buffer)
      if (ergBalance - ergInput < 0.1) return true

      return false
    }

    return true // Disable for unsupported swap types
  }

  return (
    <>
      <Card className="w-[580px] rounded-2xl">
        <CardHeader className="space-y-1.5 p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <h2 className="text-4xl font-bold">Reactor</h2>
              <p className="text-2xl font-semibold text-orange-500 italic">
                {getTitle(currentAction)}
              </p>
              <p className="text-sm text-muted-foreground">
                {getDescription(currentAction)}
              </p>
              {initError && (
                <p className="text-sm text-red-500">
                  {initError}
                </p>
              )}
              {isInitializing && (
                <p className="text-sm text-yellow-500">
                  Initializing Gluon...
                </p>
              )}
              {!boxesReady && !isInitializing && !initError && (
                <p className="text-sm text-yellow-500">
                  Waiting for Gluon boxes...
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg bg-white/5"
            >
              <Settings2 className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-0 space-y-2">
          {renderTokenCard(true)}

          <div className="relative h-0">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-md z-10"
              onClick={handleSwapTokens}
              disabled={!boxesReady || isCalculating}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5h8M8 1L4 5l4-4M12 11H4M8 15l4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>

          {renderTokenCard(false)}

          <Button
            className={cn(
              "w-full bg-orange-500 h-12 mt-4",
              !isSwapDisabled() ? "hover:bg-orange-600" : "opacity-50 cursor-not-allowed"
            )}
            onClick={handleSwap}
            disabled={isSwapDisabled()}
          >
            {isLoading ? "Processing..." :
              isCalculating ? "Calculating..." :
                !boxesReady ? "Initializing..." :
                  "Swap"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-[440px] rounded-2xl mt-4">
        <CardContent className="p-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input Amount</span>
              <span className="text-muted-foreground">
                {formatTokenAmount(formatValue(receiptDetails.inputAmount))} {fromToken.symbol}
              </span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Dev Fee</span>
              <span className="text-muted-foreground">
                {formatTokenAmount(formatValue(receiptDetails.fees.devFee))} ERG
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">UI Fee</span>
              <span className="text-muted-foreground">
                {formatTokenAmount(formatValue(receiptDetails.fees.uiFee))} ERG
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Miner Fee</span>
              <span className="text-muted-foreground">
                {formatTokenAmount(formatValue(receiptDetails.fees.minerFee))} ERG
              </span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between font-medium">
              <span>Total Fees</span>
              <span>{formatTokenAmount(formatValue(receiptDetails.fees.totalFee))} ERG</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between font-medium text-base">
              <span>You Will Receive</span>
              <div className="text-right">
                {toToken.symbol === "ERG" && (
                  <span>{formatTokenAmount(formatValue(receiptDetails.outputAmount.erg))} ERG</span>
                )}
                {toToken.symbol === "GAU-GAUC" && (
                  <>
                    <div>{formatTokenAmount(formatValue(receiptDetails.outputAmount.gau))} GAU</div>
                    <div>{formatTokenAmount(formatValue(receiptDetails.outputAmount.gauc))} GAUC</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}