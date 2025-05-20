import { TOKEN_ADDRESS } from '@/lib/constants/token'
import BigNumber from 'bignumber.js'

// Configure BigNumber
BigNumber.config({
  DECIMAL_PLACES: 9, // Maximum blockchain precision
  ROUNDING_MODE: BigNumber.ROUND_DOWN, // Always truncate, never round up
  EXPONENTIAL_AT: [-9, 20] // Force decimal notation for small numbers
})

interface FormattedNumber {
  display: string
  tooltip: string
}

/**
 * Converts a value from decimal representation (e.g., from blockchain)
 * @param value - Raw number from blockchain
 * @param decimals - Number of decimals (defaults to TOKEN_ADDRESS.decimals)
 */
export const convertFromDecimals = (value: number | bigint | string, decimals: number = TOKEN_ADDRESS.decimals): BigNumber => {
  const bn = new BigNumber(value.toString())
  return bn.dividedBy(new BigNumber(10).pow(decimals))
}

/**
 * Converts a value to decimal representation (e.g., for blockchain)
 * @param value - Human readable number
 * @param decimals - Number of decimals (defaults to TOKEN_ADDRESS.decimals)
 */
export const convertToDecimals = (value: number | string, decimals: number = TOKEN_ADDRESS.decimals): bigint => {
  const bn = new BigNumber(value.toString())
  const multiplied = bn.times(new BigNumber(10).pow(decimals))
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString())
}

/**
 * Formats numbers for macro display (statistics, overviews)
 * Uses full words for millions and above, K for thousands
 */
export const formatMacroNumber = (value: number | string | BigNumber): FormattedNumber => {
  const bn = new BigNumber(value.toString())
  if (bn.isZero()) return { display: '0', tooltip: '0' }

  const absValue = bn.abs()
  const trillion = new BigNumber(1000000000000)
  const billion = new BigNumber(1000000000)
  const million = new BigNumber(1000000)
  const thousand = new BigNumber(1000)

  let display: string
  if (absValue.gte(trillion)) {
    display = `${bn.dividedBy(trillion).toFormat(2).replace(/\.?0+$/, '')}T`
  } else if (absValue.gte(billion)) {
    display = `${bn.dividedBy(billion).toFormat(2).replace(/\.?0+$/, '')}B`
  } else if (absValue.gte(million)) {
    display = `${bn.dividedBy(million).toFormat(2).replace(/\.?0+$/, '')}M`
  } else if (absValue.gte(thousand)) {
    display = `${bn.dividedBy(thousand).toFormat(2).replace(/\.?0+$/, '')}K`
  } else {
    display = bn.toFormat(2).replace(/\.?0+$/, '')
  }

  return {
    display,
    tooltip: bn.toFormat()
  }
}

/**
 * Formats numbers for micro display (exact amounts)
 * Shows exact values with proper decimal handling
 */
export const formatMicroNumber = (value: number | string | BigNumber): FormattedNumber => {
  const bn = new BigNumber(value.toString())
  if (bn.isZero()) return { display: '0', tooltip: '0' }

  // For values >= 1, use standard formatting
  if (bn.gte(1)) {
    const formatted = bn.toFormat(9, {
      groupSize: 3,
      decimalSeparator: '.',
      groupSeparator: ',',
      secondaryGroupSize: 0,
      fractionGroupSeparator: ' ',
      fractionGroupSize: 0
    }).replace(/\.?0+$/, '')
    return {
      display: formatted,
      tooltip: formatted
    }
  }

  // For small numbers below 1
  if (bn.lt(1) && bn.gt(0)) {
    // For very small numbers
    if (bn.lt(0.01)) {
      const decimalStr = bn.toFormat(9, {
        groupSize: 3,
        decimalSeparator: '.',
        groupSeparator: ',',
        secondaryGroupSize: 0,
        fractionGroupSeparator: ' ',
        fractionGroupSize: 0
      })

      // Count leading zeros after decimal point
      const match = decimalStr.match(/^0\.(0+)/)
      if (match) {
        const leadingZeros = match[1].length
        if (leadingZeros > 2) {
          // Extract first significant digits after zeros
          const significantPart = decimalStr.slice(2 + leadingZeros).slice(0, 2)
          return {
            display: `0.${leadingZeros > 2 ? `0<sup>${leadingZeros}</sup>` : '0'.repeat(leadingZeros)}${significantPart}`,
            tooltip: decimalStr
          }
        }
      }
    }

    // For numbers between 0.01 and 1
    return {
      display: bn.toFormat(9, {
        groupSize: 3,
        decimalSeparator: '.',
        groupSeparator: ',',
        secondaryGroupSize: 0,
        fractionGroupSeparator: ' ',
        fractionGroupSize: 0
      }).replace(/\.?0+$/, ''),
      tooltip: bn.toString()
    }
  }

  return {
    display: bn.toString(),
    tooltip: bn.toString()
  }
}

/**
 * Main formatting function that decides between macro and micro formatting
 * @param value - Number to format
 * @param isMacro - Force macro formatting for statistics displays
 */
export const formatNumber = (value: number | string | BigNumber, isMacro: boolean = false): FormattedNumber => {
  return isMacro ? formatMacroNumber(value) : formatMicroNumber(value)
}

export const nanoErgsToErgs = (nanoErgs: number | bigint | string): BigNumber => {
  return new BigNumber(nanoErgs.toString()).dividedBy(new BigNumber(10).pow(9))
}

export const ergsToNanoErgs = (ergs: number | string): bigint => {
  const bn = new BigNumber(ergs.toString())
  const multiplied = bn.times(new BigNumber(10).pow(9))
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString())
}

export const UIFriendlyValue = (input: number | bigint | string, divisor?: number): BigNumber => {
  const bn = new BigNumber(input.toString())
  return bn.dividedBy(new BigNumber(10).pow(divisor ?? 9))
}

export const APIFriendlyValue = (input: number | string, divisor?: number): bigint => {
  const bn = new BigNumber(input.toString())
  const multiplied = bn.times(new BigNumber(10).pow(divisor ?? 9))
  return BigInt(multiplied.integerValue(BigNumber.ROUND_DOWN).toString())
}