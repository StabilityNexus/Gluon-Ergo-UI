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
import { useState, useCallback } from "react"
import { cn } from "@/lib/utils/utils"


type TokenSymbol = "ERG" | "GAU" | "GAUC" | "GAU-GAUC"
type SwapAction = "erg-to-gau-gauc" | "gau-gauc-to-erg" | "gauc-to-gau" | "gau-to-gauc"

interface Token {
  symbol: TokenSymbol
  name: string
  color: string
  balance: string
}

interface TokenPair {
  from: TokenSymbol
  to: TokenSymbol
}

const VALID_PAIRS: TokenPair[] = [
  { from: "ERG", to: "GAU-GAUC" },
  { from: "GAU-GAUC", to: "ERG" },
  { from: "GAU", to: "GAUC" },
  { from: "GAUC", to: "GAU" }
]

const tokens: Token[] = [
  {
    symbol: "ERG",
    name: "Ergo",
    color: "bg-blue-600",
    balance: "1250",
  },
  {
    symbol: "GAU",
    name: "Gluon Gold",
    color: "bg-yellow-500",
    balance: "1250",
  },
  {
    symbol: "GAUC",
    name: "Gluon Gold Complement",
    color: "bg-red-500",
    balance: "1250",
  },
  {
    symbol: "GAU-GAUC",
    name: "Gluon Pair",
    color: "bg-orange-500",
    balance: "1250",
  },
]

export function ReactorSwap() {
  const [fromToken, setFromToken] = useState<Token>(tokens[0])
  const [toToken, setToToken] = useState<Token>(tokens[3])
  const [fromAmount, setFromAmount] = useState<string>("1.000,00")
  const [toAmount, setToAmount] = useState<string>("1.000,00")
  const [gauAmount, setGauAmount] = useState<string>("1500")
  const [gaucAmount, setGaucAmount] = useState<string>("3560")

  const getValidToTokens = useCallback((fromSymbol: TokenSymbol): Token[] => {
    const validSymbols = VALID_PAIRS
      .filter(pair => pair.from === fromSymbol)
      .map(pair => pair.to)
    return tokens.filter(token => validSymbols.includes(token.symbol))
  }, [])

  const getActionType = useCallback((): SwapAction => {
    if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") return "erg-to-gau-gauc"
    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") return "gau-gauc-to-erg"
    if (fromToken.symbol === "GAUC" && toToken.symbol === "GAU") return "gauc-to-gau"
    return "gau-to-gauc"
  }, [fromToken.symbol, toToken.symbol])

  const getDescription = useCallback((): string => {
    switch (getActionType()) {
      case "erg-to-gau-gauc":
        return "You're using fission converting ERG into GAU and GAUC"
      case "gau-gauc-to-erg":
        return "You're using fusion to convert GAU-GAUC into ERG"
      case "gauc-to-gau":
        return "You're using transmutation to convert GAUC into GAU"
      case "gau-to-gauc":
        return "You're using transmutation to convert GAU into GAUC"
    }
  }, [getActionType])

  const getTitle = useCallback((): string => {
    switch (getActionType()) {
      case "erg-to-gau-gauc":
        return "FISSION"
      case "gau-gauc-to-erg":
        return "FUSION"
      default:
        return "TRANSMUTATION"
    }
  }, [getActionType])

  const handleFromTokenChange = (symbol: string) => {
    const newToken = tokens.find(t => t.symbol === symbol)
    if (!newToken) return

    setFromToken(newToken)
    const validToTokens = getValidToTokens(newToken.symbol)
    if (!validToTokens.find(t => t.symbol === toToken.symbol)) {
      setToToken(validToTokens[0])
    }
  }

  const handleToTokenChange = (symbol: string) => {
    const newToken = tokens.find(t => t.symbol === symbol)
    if (!newToken) return

    const validToTokens = getValidToTokens(fromToken.symbol)
    if (validToTokens.find(t => t.symbol === newToken.symbol)) {
      setToToken(newToken)
    }
  }

  const handleSwapTokens = () => {
    const validToTokens = getValidToTokens(toToken.symbol)
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

  const calculateAmounts = (value: string, isFromInput: boolean) => {
    const numValue = parseFloat(value.replace(",", ".")) || 0

    if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
      if (isFromInput) {
        setGauAmount((numValue * 0.7).toFixed(2))
        setGaucAmount((numValue * 0.3).toFixed(2))
      } else {
        // Handle reverse calculation if needed
      }
    } else if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      if (isFromInput) {
        // Handle GAU-GAUC to ERG calculation
      } else {
        setGauAmount((numValue * 1.4).toFixed(2))
        setGaucAmount((numValue * 0.6).toFixed(2))
      }
    }
    // Add other token pair calculations as needed
  }

  const handleAmountChange = (value: string, isFromInput: boolean) => {
    const numValue = parseFloat(value)
    
    // Enforce min/max limits
    if (numValue > 100000) {
      value = "100000"
    } else if (numValue < 0.1) {
      value = "0.1"
    }
  
    if (isFromInput) {
      setFromAmount(value)
      calculateAmounts(value, true)
    } else {
      setToAmount(value)
      calculateAmounts(value, false)
    }
  }

  const handleMax = (isFrom: boolean) => {
    const relevantToken = isFrom ? fromToken : toToken
    const balance = relevantToken.balance
    if (isFrom) {
      setFromAmount(balance)
      calculateAmounts(balance, true)
    } else {
      setToAmount(balance)
      calculateAmounts(balance, false)
    }
  }

  const renderAmountInput = (isFrom: boolean) => {
    const relevantToken = isFrom ? fromToken : toToken
    const amount = isFrom ? fromAmount : toAmount
    const isGauGauc = relevantToken.symbol === "GAU-GAUC"

    return (
      <div className="flex items-center justify-end flex-1">
        <Input
          type="number"
          value={amount}
          min={0.1}
          max={100000}
          onChange={(e) => !isGauGauc && handleAmountChange(e.target.value, isFrom)}
          readOnly={isGauGauc}
          placeholder="0"
          className="w-full text-right border-0 bg-transparent text-4xl font-bold focus-visible:ring-0"
        />
        {!isGauGauc && (
          <button
            onClick={() => handleMax(isFrom)}
            className="font-semibold text-sm text-accent"
          >
            MAX
          </button>
        )}
      </div>
    )
  }

  const renderTokenCard = (isFrom: boolean) => (
    <div className="rounded-xl bg-gradient-to-r from-white/10 to-white/5 p-4 w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-muted-foreground">{isFrom ? "From" : "To"}</span>
        {((isFrom && fromToken.symbol !== "GAU-GAUC") || (!isFrom && toToken.symbol !== "GAU-GAUC")) && (
          <span className="text-sm text-muted-foreground">
            Balance: {isFrom ? fromToken.balance : toToken.balance} {isFrom ? fromToken.symbol : toToken.symbol}
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
            {(isFrom ? tokens : getValidToTokens(fromToken.symbol)).map((token) => (
              <SelectItem key={token.symbol} value={token.symbol}>
                {token.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
  
        {(isFrom ? fromToken.symbol : toToken.symbol) !== "GAU-GAUC" && (
          renderAmountInput(isFrom)
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
            Balance: {tokens[1].balance} GAU
          </span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{gauAmount}</span>
            <div className="px-1 py-0.5 rounded-lg font-bold text-xs bg-yellow-500">
              GAU
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <div>
            <span className="text-sm text-muted-foreground block mb-2">
              Balance: {tokens[2].balance} GAUC
            </span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{gaucAmount}</span>
              <div className="px-1 py-0.5 rounded-lg font-bold text-xs bg-red-500">
                GAUC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Card className="w-[580px] rounded-2xl">
        <CardHeader className="space-y-1.5 p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <h2 className="text-4xl font-bold">Reactor</h2>
              <p className="text-2xl font-semibold text-orange-500 italic">
                {getTitle()}
              </p>
              <p className="text-sm text-muted-foreground">
                {getDescription()}
              </p>
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
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5h8M8 1L4 5l4-4M12 11H4M8 15l4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </div>

          {renderTokenCard(false)}

          <Button 
            className="w-full bg-orange-500 hover:bg-orange-600 h-12 mt-4"
            onClick={() => console.log(`Performing ${getActionType()}`)}
          >
            Swap
          </Button>
        </CardContent>
      </Card>

      <Card className="w-[440px] rounded-2xl mt-4">
        <CardContent className="p-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Impact</span>
              <span className="text-muted-foreground">0.12%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Miner Fee</span>
              <span className="text-muted-foreground">0.001 ERG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DEX Fee</span>
              <span className="text-muted-foreground">0.002 ERG</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>0.003 ERG</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}