import { SwapResult, SwapError, ReceiptDetails } from './types'
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs } from '@/lib/utils/erg-converter'
import { formatMicroNumber } from '@/lib/utils/erg-converter'

interface FissionParams {
    gluonInstance: any
    gluonBox: any
    value: string
}

export const calculateFissionAmounts = async (
    { gluonInstance, gluonBox, value }: FissionParams
): Promise<SwapResult | SwapError> => {
    try {
        const numValue = parseFloat(value) || 0
        console.log("🔍 FISSION INPUT:", {
            rawValue: value,
            numValue,
            type: typeof value
        })

        // Convert input ERG to nanoERG for SDK
        const ergToFission = ergsToNanoErgs(numValue)
        console.log("🔍 FISSION ERG CONVERSION:", {
            ergToFission: ergToFission.toString(),
            type: typeof ergToFission
        })

        // Get prediction of GAU/GAUC amounts
        const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(ergToFission))
        console.log("🔍 FISSION PREDICTION RAW:", willGet)

        if (!willGet) {
            throw new Error("Failed to get fission prediction")
        }

        // Format the values using our utility - NOTE: neutrons are GAUC, protons are GAU
        const formattedGau = formatMicroNumber(convertFromDecimals(willGet.neutrons))
        const formattedGauc = formatMicroNumber(convertFromDecimals(willGet.protons))
        console.log("🔍 FISSION FORMATTED:", {
            gau: formattedGau,
            gauc: formattedGauc,
            rawNeutrons: willGet.neutrons.toString(),
            rawProtons: willGet.protons.toString()
        })

        // Get fee prediction
        const fees = await gluonInstance.getTotalFeeAmountFission(gluonBox, Number(ergToFission))
        console.log("🔍 FISSION FEES:", fees)

        const receiptDetails: ReceiptDetails = {
            inputAmount: numValue,
            outputAmount: {
                gau: convertFromDecimals(willGet.neutrons), // Swap neutrons/protons here too
                gauc: convertFromDecimals(willGet.protons),
                erg: 0
            },
            fees: {
                devFee: nanoErgsToErgs(fees.devFee),
                uiFee: nanoErgsToErgs(fees.uiFee),
                minerFee: nanoErgsToErgs(fees.oracleFee),
                totalFee: nanoErgsToErgs(fees.totalFee)
            }
        }

        return {
            gauAmount: formattedGau.display,
            gaucAmount: formattedGauc.display,
            toAmount: "0", // Not used in fission
            receiptDetails
        }
    } catch (error) {
        console.error("Error calculating fission amounts:", error)
        return {
            error: error instanceof Error ? error.message : "Failed to calculate fission amounts",
            resetValues: {
                gauAmount: "0",
                gaucAmount: "0"
            }
        }
    }
}

export const handleFissionSwap = async (
    gluonInstance: any,
    gluonBox: any,
    oracleBox: any,
    userBoxes: any[],
    nodeService: any,
    ergoWallet: any,
    amount: string
): Promise<{ txHash?: string; error?: string }> => {
    try {
        console.log("🔍 FISSION SWAP INPUT:", {
            amount,
            type: typeof amount
        })

        const nanoErgsToFission = ergsToNanoErgs(amount)
        console.log("🔍 FISSION NANO ERGS:", {
            nanoErgsToFission: nanoErgsToFission.toString(),
            type: typeof nanoErgsToFission
        })

        const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(nanoErgsToFission))
        console.log("🔍 FISSION WILL GET:", {
            neutrons: willGet.neutrons.toString(),
            protons: willGet.protons.toString()
        })

        const unsignedTransaction = await gluonInstance.fissionForEip12(
            gluonBox,
            oracleBox,
            userBoxes,
            Number(nanoErgsToFission)
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
        console.error("Fission failed:", error)
        if (error instanceof Error) {
            console.error("Error details:", error.stack)
        }
        return { error: "Failed to process fission transaction" }
    }
}
