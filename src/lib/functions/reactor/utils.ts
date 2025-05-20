import { Token, TokenSymbol, SwapAction } from './types'
import BigNumber from 'bignumber.js'

export const VALID_PAIRS = [
    { from: "ERG", to: "GAU-GAUC" },
    { from: "GAU-GAUC", to: "ERG" },
    { from: "GAU", to: "GAUC" },
    { from: "GAUC", to: "GAU" }
] as const

export const defaultTokens: Token[] = [
    {
        symbol: "ERG",
        name: "Ergo",
        color: "bg-blue-600",
        balance: "0",
    },
    {
        symbol: "GAU",
        name: "Gluon Gold",
        color: "bg-yellow-500",
        balance: "0",
    },
    {
        symbol: "GAUC",
        name: "Gluon Gold Complement",
        color: "bg-red-500",
        balance: "0",
    },
    {
        symbol: "GAU-GAUC",
        name: "Gluon Pair",
        color: "bg-orange-500",
        balance: "0",
    },
]

export const getValidToTokens = (fromSymbol: TokenSymbol, tokens: Token[]): Token[] => {
    const validSymbols = VALID_PAIRS
        .filter(pair => pair.from === fromSymbol)
        .map(pair => pair.to)
    return tokens.filter(token => validSymbols.includes(token.symbol))
}

export const getActionType = (fromSymbol: TokenSymbol, toSymbol: TokenSymbol): SwapAction => {
    if (fromSymbol === "ERG" && toSymbol === "GAU-GAUC") return "erg-to-gau-gauc"
    if (fromSymbol === "GAU-GAUC" && toSymbol === "ERG") return "gau-gauc-to-erg"
    if (fromSymbol === "GAUC" && toSymbol === "GAU") return "gauc-to-gau"
    return "gau-to-gauc"
}

export const getDescription = (action: SwapAction): string => {
    switch (action) {
        case "erg-to-gau-gauc":
            return "You're using fission converting ERG into GAU and GAUC"
        case "gau-gauc-to-erg":
            return "You're using fusion to convert GAU-GAUC into ERG"
        case "gauc-to-gau":
            return "You're using transmutation to convert GAUC into GAU"
        case "gau-to-gauc":
            return "You're using transmutation to convert GAU into GAUC"
    }
}

export const getTitle = (action: SwapAction): string => {
    switch (action) {
        case "erg-to-gau-gauc":
            return "FISSION"
        case "gau-gauc-to-erg":
            return "FUSION"
        default:
            return "TRANSMUTATION"
    }
}

export const validateAmount = (value: string, maxBalance: string): string => {
    const numValue = parseFloat(value)
    const maxValue = parseFloat(maxBalance)

    if (isNaN(numValue) || numValue < 0) return "0"
    if (numValue > maxValue) return maxBalance
    return value
}

export const formatValue = (value: number | BigNumber): string => {
    if (value instanceof BigNumber) {
        return value.toString()
    }
    return value.toString()
}
