import { SwapResult, SwapError, ReceiptDetails } from "./types";
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs } from "@/lib/utils/erg-converter";
import { formatMicroNumber } from "@/lib/utils/erg-converter";
import { handleTransactionError, handleTransactionSuccess, handleCalculationError } from "@/lib/utils/error-handler";

interface FissionParams {
  gluonInstance: any;
  gluonBox: any;
  value: string;
}

export const calculateFissionAmounts = async ({ gluonInstance, gluonBox, value }: FissionParams): Promise<SwapResult | SwapError> => {
  try {
    const numValue = parseFloat(value) || 0;
    console.log("🔍 FISSION INPUT:", {
      rawValue: value,
      numValue,
      type: typeof value,
    });

    // Convert input ERG to nanoERG for SDK
    const ergToFission = ergsToNanoErgs(numValue);
    console.log("🔍 FISSION ERG CONVERSION:", {
      ergToFission: ergToFission.toString(),
      type: typeof ergToFission,
    });

    // Get prediction of stable/volatile asset amounts
    const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(ergToFission));
    console.log("🔍 FISSION PREDICTION RAW:", willGet);

    if (!willGet) {
      throw new Error("Failed to get fission prediction from SDK");
    }

    // Format the values using our utility - NOTE: protons are volatile asset, neutrons are stable asset
    const formattedStable = formatMicroNumber(convertFromDecimals(willGet.neutrons));
    const formattedVolatile = formatMicroNumber(convertFromDecimals(willGet.protons));
    console.log("🔍 FISSION FORMATTED:", {
      stableAsset: formattedStable,
      volatileAsset: formattedVolatile,
      rawNeutrons: willGet.neutrons.toString(),
      rawProtons: willGet.protons.toString(),
    });

    // Get fee prediction
    const fees = await gluonInstance.getTotalFeeAmountFission(gluonBox, Number(ergToFission));
    console.log("🔍 FISSION FEES:", fees);

    const receiptDetails: ReceiptDetails = {
      inputAmount: numValue,
      outputAmount: {
        stableAsset: convertFromDecimals(willGet.neutrons), // neutrons are stable asset
        volatileAsset: convertFromDecimals(willGet.protons), // protons are volatile asset
        erg: 0,
        // Legacy fields for backward compatibility
        gau: convertFromDecimals(willGet.neutrons),
        gauc: convertFromDecimals(willGet.protons),
      },
      fees: {
        devFee: nanoErgsToErgs(fees.devFee),
        uiFee: nanoErgsToErgs(fees.uiFee),
        oracleFee: nanoErgsToErgs(fees.oracleFee),
        minerFee: nanoErgsToErgs(fees.minerFee),
        totalFee: nanoErgsToErgs(fees.totalFee),
      },
    };

    return {
      stableAssetAmount: formattedStable.display,
      volatileAssetAmount: formattedVolatile.display,
      toAmount: "0", // Not used in fission
      receiptDetails,
      maxErgOutput: "0", // Not applicable for fission
      // Legacy fields for backward compatibility
      gauAmount: formattedStable.display,
      gaucAmount: formattedVolatile.display,
    };
  } catch (error) {
    console.error("Error calculating fission amounts:", error);

    // Use the error handler for proper classification
    const errorDetails = handleCalculationError(error, "fission");

    return {
      error: errorDetails.userMessage,
      resetValues: {
        stableAssetAmount: "0",
        volatileAssetAmount: "0",
        // Legacy fields for backward compatibility
        gauAmount: "0",
        gaucAmount: "0",
      },
    };
  }
};

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
      type: typeof amount,
    });

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

    const nanoErgsToFission = ergsToNanoErgs(amount);
    console.log("🔍 FISSION NANO ERGS:", {
      nanoErgsToFission: nanoErgsToFission.toString(),
      type: typeof nanoErgsToFission,
    });

    // Verify we can get the expected output
    const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(nanoErgsToFission));
    console.log("🔍 FISSION WILL GET:", {
      neutrons: willGet.neutrons.toString(),
      protons: willGet.protons.toString(),
    });

    if (!willGet || (willGet.neutrons === 0 && willGet.protons === 0)) {
      throw new Error("Invalid fission amount - no tokens will be generated");
    }

    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    // Create unsigned transaction
    const unsignedTransaction = await gluonInstance.fissionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, Number(nanoErgsToFission));

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
    handleTransactionSuccess(txHash, "fission");

    return { txHash };
  } catch (error) {
    console.error("Fission failed:", error);

    // Use the error handler for proper classification and toast notification
    const errorDetails = handleTransactionError(error, "fission");

    return { error: errorDetails.userMessage };
  }
};
