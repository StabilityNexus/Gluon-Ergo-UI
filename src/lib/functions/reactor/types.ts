import BigNumber from 'bignumber.js'

export type TokenSymbol = "ERG" | "GAU" | "GAUC" | "GAU-GAUC"
export type SwapAction = "erg-to-gau-gauc" | "gau-gauc-to-erg" | "gauc-to-gau" | "gau-to-gauc"

export interface Token {
    symbol: TokenSymbol
    name: string
    color: string
    balance: string
    tokenId: string
    decimals: number
}

export interface TokenPair {
    from: TokenSymbol
    to: TokenSymbol
}

export interface ReceiptDetails {
    inputAmount: number | BigNumber
    outputAmount: {
        gau: number | BigNumber
        gauc: number | BigNumber
        erg: number | BigNumber
    }
    fees: {
        devFee: number | BigNumber
        uiFee: number | BigNumber
        minerFee: number | BigNumber
        totalFee: number | BigNumber
    }
    maxErgOutput?: string
}

export interface BoxData {
    assets?: any[]
    additionalRegisters?: Record<string, any>
    value?: number
}

export interface GluonBoxes {
    gluonBox: any
    oracleBox: any
}

export interface SwapResult {
    gauAmount: string
    gaucAmount: string
    toAmount: string
    maxErgOutput: string
    receiptDetails: ReceiptDetails
}

export interface SwapError {
    error: string
    resetValues?: {
        gauAmount?: string
        gaucAmount?: string
        toAmount?: string
    }
}
