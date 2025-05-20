import { SwapResult, SwapError, ReceiptDetails } from './types'
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs, convertToDecimals } from '@/lib/utils/erg-converter'
import { formatMicroNumber } from '@/lib/utils/erg-converter'
import BigNumber from 'bignumber.js'

interface FusionParams {
    gluonInstance: any
    gluonBox: any
    value: string
    gauBalance: string
    gaucBalance: string
}

/**
 * Calculate the maximum possible ERG output based on available GAU/GAUC balances
 */
const calculateMaxErgOutput = async (
    gluonInstance: any,
    gluonBox: any,
    gauBalance: string,
    gaucBalance: string
): Promise<BigNumber> => {
    try {
        // Convert our balances to blockchain decimals (these are BigInts)
        const gauAmount = BigInt(convertToDecimals(gauBalance))
        const gaucAmount = BigInt(convertToDecimals(gaucBalance))

        console.log("Input Validation:", {
            displayValues: {
                gau: gauBalance,
                gauc: gaucBalance
            },
            nanoValues: {
                gauNano: gauAmount.toString(),
                gaucNano: gaucAmount.toString()
            }
        })

        // Get token ratio for 1 ERG
        const oneErg = BigInt(1e9) // 1 ERG in nanoErgs
        const { neutrons: neutronsForOneErg, protons: protonsForOneErg } = await gluonInstance.fusionWillNeed(gluonBox, Number(oneErg))

        // Convert to BigInt immediately
        const neutronsNeeded = BigInt(neutronsForOneErg)
        const protonsNeeded = BigInt(protonsForOneErg)

        // Calculate maximum ERG we can get based on our token ratios
        // All calculations done in BigInt
        const maxFromGau = (gauAmount * oneErg) / neutronsNeeded
        const maxFromGauc = (gaucAmount * oneErg) / protonsNeeded
        const maxPossibleNanoErgs = maxFromGau < maxFromGauc ? maxFromGau : maxFromGauc

        console.log("Max ERG Calculation:", {
            maxErg: nanoErgsToErgs(Number(maxPossibleNanoErgs)),
            maxNanoErg: maxPossibleNanoErgs.toString()
        })

        return new BigNumber(maxPossibleNanoErgs.toString())
    } catch (error) {
        console.error("Error calculating max ERG output:", error)
        return new BigNumber(0)
    }
}

/**
 * Calculate the amounts of GAU and GAUC needed for fusion to get the desired ERG amount
 */
export const calculateFusionAmounts = async (
    { gluonInstance, gluonBox, value, gauBalance, gaucBalance }: FusionParams
): Promise<SwapResult | SwapError> => {
    try {
        // Get maximum possible ERG output
        const maxNanoErgs = await calculateMaxErgOutput(gluonInstance, gluonBox, gauBalance, gaucBalance)
        const maxErgStr = nanoErgsToErgs(maxNanoErgs.toNumber()).toString()

        // Convert desired ERG to nanoERGs (as BigInt for comparison)
        const desiredNanoErgs = BigInt(ergsToNanoErgs(value))

        // Validate desired amount
        if (desiredNanoErgs > BigInt(maxNanoErgs.toString())) {
            return {
                error: `Cannot get ${value} ERG. Maximum possible output is ${maxErgStr} ERG`,
                resetValues: {
                    gauAmount: "0",
                    gaucAmount: "0"
                }
            }
        }

        // Calculate required token amounts using SDK's function
        const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(desiredNanoErgs))

        // Convert to display values
        const requiredGau = convertFromDecimals(BigInt(neutrons)).toString()
        const requiredGauc = convertFromDecimals(BigInt(protons)).toString()

        // Get fee prediction (using Number since the SDK expects it)
        const fees = await gluonInstance.getTotalFeeAmountFusion(gluonBox, Number(desiredNanoErgs))

        const receiptDetails: ReceiptDetails = {
            inputAmount: parseFloat(requiredGau),
            outputAmount: {
                gau: parseFloat(requiredGau),
                gauc: parseFloat(requiredGauc),
                erg: parseFloat(value)
            },
            fees: {
                devFee: nanoErgsToErgs(fees.devFee),
                uiFee: nanoErgsToErgs(fees.uiFee),
                minerFee: nanoErgsToErgs(fees.oracleFee),
                totalFee: nanoErgsToErgs(fees.totalFee)
            },
            maxErgOutput: maxErgStr
        }

        return {
            gauAmount: requiredGau,
            gaucAmount: requiredGauc,
            toAmount: value,
            maxErgOutput: maxErgStr,
            receiptDetails
        }
    } catch (error) {
        console.error("Error calculating fusion amounts:", error)
        return {
            error: error instanceof Error ? error.message : "Failed to calculate fusion amounts",
            resetValues: {
                gauAmount: "0",
                gaucAmount: "0",
                toAmount: "0"
            }
        }
    }
}

export const handleFusionSwap = async (
    gluonInstance: any,
    gluonBox: any,
    oracleBox: any,
    userBoxes: any[],
    nodeService: any,
    ergoWallet: any,
    amount: string
): Promise<{ txHash?: string; error?: string }> => {
    try {
        console.log("amount being passed", amount)
        const height = await nodeService.getNetworkHeight()
        const oracleBoxJs = await gluonInstance.getGoldOracleBox()
        const gluonBoxJs = await gluonInstance.getGluonBox()

        // Convert the desired ERG output amount to nanoERGs
        const nanoErgsToFuse = ergsToNanoErgs(amount)
        console.log("amount to nano ergs", nanoErgsToFuse)
        // Get required token amounts for verification
        const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(nanoErgsToFuse))
        console.log("neutrons", neutrons)
        console.log("protons", protons)
        // Convert to proper display values
        const requiredGau = convertFromDecimals(BigInt(neutrons)).toString()
        const requiredGauc = convertFromDecimals(BigInt(protons)).toString()

        console.log("Transaction Value Verification:", {
            input: {
                requestedErg: amount,
                nanoErgsToFuse: nanoErgsToFuse.toString(),
            },
            tokensToBeConsumed: {
                rawNeutrons: neutrons.toString(),
                rawProtons: protons.toString(),
                displayGau: requiredGau,
                displayGauc: requiredGauc
            }
        })

        const unsignedTransaction = await gluonInstance.fusionForEip12(
            gluonBoxJs,
            oracleBoxJs,
            userBoxes,
            Number(nanoErgsToFuse)
        )

        if (!unsignedTransaction) {
            throw new Error("Failed to create unsigned transaction")
        }

        console.log("Signing and submitting transaction...")
        const signature = await ergoWallet?.sign_tx(unsignedTransaction)
        const txHash = await ergoWallet?.submit_tx(signature)

        console.log("Transaction submitted successfully. TxId:", txHash)
        return { txHash }

    } catch (error) {
        console.error("Fusion failed:", error)
        if (error instanceof Error) {
            console.error("Error details:", error.stack)
        }
        return { error: "Failed to process fusion transaction" }
    }
}
