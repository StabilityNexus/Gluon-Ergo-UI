import { SwapResult, SwapError, ReceiptDetails } from "./types";
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs, convertToDecimals } from "@/lib/utils/erg-converter";
import { handleTransactionError, handleTransactionSuccess, handleCalculationError } from "@/lib/utils/error-handler";
import BigNumber from "bignumber.js";

interface FusionParams {
  gluonInstance: any;
  gluonBox: any;
  value: string;
  stableAssetBalance: string;
  volatileAssetBalance: string;
  // Legacy fields for backward compatibility
  gauBalance: string;
  gaucBalance: string;
}

/**
 * Calculate the maximum possible ERG output based on available stable/volatile asset balances
 */
const calculateMaxErgOutput = async (gluonInstance: any, gluonBox: any, stableAssetBalance: string, volatileAssetBalance: string): Promise<BigNumber> => {
  try {
    // Convert our balances to blockchain decimals (these are BigInts)
    const stableAmount = BigInt(convertToDecimals(stableAssetBalance));
    const volatileAmount = BigInt(convertToDecimals(volatileAssetBalance));

    console.log("Input Validation:", {
      displayValues: {
        stableAsset: stableAssetBalance,
        volatileAsset: volatileAssetBalance,
      },
      nanoValues: {
        stableNano: stableAmount.toString(),
        volatileNano: volatileAmount.toString(),
      },
    });

    // Get token ratio for 1 ERG
    const oneErg = BigInt(1e9); // 1 ERG in nanoErgs
    const _fusionNeedRes = await gluonInstance.fusionWillNeed(gluonBox, Number(oneErg));
    const { neutrons: neutronsForOneErg, protons: protonsForOneErg } = _fusionNeedRes;

    // Convert to BigInt immediately
    const neutronsNeeded = BigInt(neutronsForOneErg);
    const protonsNeeded = BigInt(protonsForOneErg);

    // Calculate maximum ERG we can get based on our token ratios
    // All calculations done in BigInt
    const maxFromStable = (stableAmount * oneErg) / neutronsNeeded;
    const maxFromVolatile = (volatileAmount * oneErg) / protonsNeeded;
    const maxPossibleNanoErgs = maxFromStable < maxFromVolatile ? maxFromStable : maxFromVolatile;

    console.log("Max ERG Calculation:", {
      maxErg: new BigNumber(maxPossibleNanoErgs.toString()).dividedBy(1e9).toFixed(),
      maxNanoErg: maxPossibleNanoErgs.toString(),
    });

    return new BigNumber(maxPossibleNanoErgs.toString());
  } catch (error) {
    console.error("Error calculating max ERG output:", error);
    return new BigNumber(0);
  }
};

/**
 * Calculate the amounts of stable and volatile assets needed for fusion to get the desired ERG amount
 */
export const calculateFusionAmounts = async ({ gluonInstance, gluonBox, value, stableAssetBalance, volatileAssetBalance, gauBalance, gaucBalance }: FusionParams): Promise<SwapResult | SwapError> => {
  try {
    // Use new names if provided, otherwise fall back to legacy names
    const stableBalance = stableAssetBalance || gauBalance;
    const volatileBalance = volatileAssetBalance || gaucBalance;
    
    // Get maximum possible ERG output
    const maxNanoErgs = await calculateMaxErgOutput(gluonInstance, gluonBox, stableBalance, volatileBalance);
    // Use BigNumber to preserve precision instead of converting to Number
    const maxErgStr = maxNanoErgs.dividedBy(1e9).toFixed();

    // Convert desired ERG to nanoERGs (as BigInt for comparison)
    const desiredNanoErgs = BigInt(ergsToNanoErgs(value));

    // Calculate required token amounts using SDK's function
    const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(desiredNanoErgs));

    // Convert to display values
    const requiredStable = convertFromDecimals(BigInt(neutrons)).toString();
    const requiredVolatile = convertFromDecimals(BigInt(protons)).toString();

    // Get fee prediction (using Number since the SDK expects it)
    const fees = await gluonInstance.getTotalFeeAmountFusion(gluonBox, Number(desiredNanoErgs));

    const receiptDetails: ReceiptDetails = {
      inputAmount: parseFloat(requiredStable),
      outputAmount: {
        stableAsset: parseFloat(requiredStable),
        volatileAsset: parseFloat(requiredVolatile),
        erg: parseFloat(value),
        // Legacy fields for backward compatibility
        gau: parseFloat(requiredStable),
        gauc: parseFloat(requiredVolatile),
      },
      fees: {
        devFee: nanoErgsToErgs(fees.devFee),
        uiFee: nanoErgsToErgs(fees.uiFee),
        oracleFee: nanoErgsToErgs(fees.oracleFee),
        minerFee: nanoErgsToErgs(fees.minerFee),
        totalFee: nanoErgsToErgs(fees.totalFee),
      },
      maxErgOutput: maxErgStr,
    };

    return {
      stableAssetAmount: requiredStable,
      volatileAssetAmount: requiredVolatile,
      toAmount: value,
      maxErgOutput: maxErgStr,
      receiptDetails,
      // Legacy fields for backward compatibility
      gauAmount: requiredStable,
      gaucAmount: requiredVolatile,
    };
  } catch (error) {
    console.error("Error calculating fusion amounts:", error);

    // Use the error handler for proper classification
    const errorDetails = handleCalculationError(error, "fusion");

    return {
      error: errorDetails.userMessage,
      resetValues: {
        stableAssetAmount: "0",
        volatileAssetAmount: "0",
        toAmount: "0",
        // Legacy fields for backward compatibility
        gauAmount: "0",
        gaucAmount: "0",
      },
    };
  }
};

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
    console.log("amount being passed", amount);

    // Validate inputs
    if (!gluonInstance || !gluonBox || !oracleBox) {
      throw new Error("Required boxes not initialized");
    }

    if (!ergoWallet) {
      throw new Error("Wallet not connected. Please disconnect and reconnect your wallet.");
    }

    // Additional validation for wallet API methods
    if (!ergoWallet.sign_tx || !ergoWallet.submit_tx) {
      throw new Error("Wallet API not fully initialized. Please refresh the page and reconnect.");
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Invalid amount entered");
    }

    const height = await nodeService.getNetworkHeight();
    if (!height) {
      throw new Error("Failed to get network height");
    }

    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get required boxes");
    }

    // Convert the desired ERG output amount to nanoERGs
    const nanoErgsToFuse = ergsToNanoErgs(amount);
    console.log("amount to nano ergs", nanoErgsToFuse);

    // Get required token amounts for verification
    const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(nanoErgsToFuse));
    console.log("neutrons", neutrons);
    console.log("protons", protons);

    // Verify we have valid amounts
    if (!neutrons || !protons || neutrons <= 0 || protons <= 0) {
      throw new Error("Invalid fusion amounts - insufficient tokens required");
    }

    // Convert to proper display values
    const requiredStable = convertFromDecimals(BigInt(neutrons)).toString();
    const requiredVolatile = convertFromDecimals(BigInt(protons)).toString();

    console.log("Transaction Value Verification:", {
      input: {
        requestedErg: amount,
        nanoErgsToFuse: nanoErgsToFuse.toString(),
      },
      tokensToBeConsumed: {
        rawNeutrons: neutrons.toString(),
        rawProtons: protons.toString(),
        displayStable: requiredStable,
        displayVolatile: requiredVolatile,
      },
    });

    // Create unsigned transaction
    const unsignedTransaction = await gluonInstance.fusionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, Number(nanoErgsToFuse));

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Signing and submitting transaction...");

    // Sign transaction
    const signature = await ergoWallet?.sign_tx(unsignedTransaction);
    if (!signature) {
      throw new Error("Failed to sign transaction");
    }

    // Submit transaction
    const txHash = await ergoWallet?.submit_tx(signature);
    if (!txHash) {
      throw new Error("Failed to submit transaction");
    }

    console.log("Transaction submitted successfully. TxId:", txHash);

    // Handle success with toast notification
    handleTransactionSuccess(txHash, "fusion");

    return { txHash };
  } catch (error) {
    console.error("Fusion failed:", error);

    // Use the error handler for proper classification and toast notification
    const errorDetails = handleTransactionError(error, "fusion");

    return { error: errorDetails.userMessage };
  }
};
