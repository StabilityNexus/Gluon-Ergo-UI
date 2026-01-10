import { SwapResult, SwapError, ReceiptDetails, TokenSymbol } from "./types";
import { convertFromDecimals, nanoErgsToErgs, convertToDecimals } from "@/lib/utils/erg-converter";
import { formatMicroNumber } from "@/lib/utils/erg-converter";
import { handleTransactionError, handleTransactionSuccess, handleCalculationError } from "@/lib/utils/error-handler";
import { getTxReducedB64Safe } from "@/lib/utils/ergopay-tx-reducer";
import { explorerClient } from "@/lib/utils/explorer-client";
import BigNumber from "bignumber.js";

interface TransmutationParams {
  gluonInstance: any;
  gluonBox: any;
  oracleBox: any;
  nodeService: any;
  value: string;
  fromTokenSymbol: TokenSymbol;
}

export const calculateTransmutationAmounts = async ({
  gluonInstance,
  gluonBox,
  oracleBox,
  nodeService,
  value,
  fromTokenSymbol,
}: TransmutationParams): Promise<SwapResult | SwapError> => {
  try {
    const numValue = parseFloat(value) || 0;
    console.log("🔍 [DEBUG] TRANSMUTATION START", {
      rawValue: value,
      numValue,
      type: typeof value,
      fromTokenSymbol,
    });

    if (numValue <= 0) {
      return {
        error: "Amount must be greater than zero.",
        resetValues: {
          gauAmount: "0",
          gaucAmount: "0",
          toAmount: "0",
        },
      };
    }

    // Convert input amount to blockchain decimals
    const inputAmount = convertToDecimals(value);
    console.log("🔍 [DEBUG] INPUT CONVERSION", {
      originalValue: value,
      inputAmountBigInt: inputAmount.toString(),
      inputAmountNumber: Number(inputAmount),
      // Show what 9 decimals would look like
      manualNineDecimals: new BigNumber(inputAmount.toString()).dividedBy(1e9).toFixed(9),
    });

    // Get height for oracle
    const height = await nodeService.getNetworkHeight();
    if (!height) {
      throw new Error("Failed to get network height");
    }

    // Get prediction with proper error handling
    let willGet: bigint;
    try {
      if (fromTokenSymbol === "GAUC") {
        willGet = BigInt(await gluonInstance.transmuteToGoldWillGet(gluonBox, oracleBox, Number(inputAmount), height));
      } else {
        willGet = BigInt(await gluonInstance.transmuteFromGoldWillGet(gluonBox, oracleBox, Number(inputAmount), height));
      }

      console.log("🔍 [DEBUG] TRANSMUTATION PREDICTION RAW", {
        input: inputAmount.toString(),
        output: willGet.toString(),
        outputAsNumber: Number(willGet),
        // Show what 9 decimals would look like
        outputManualNineDecimals: new BigNumber(willGet.toString()).dividedBy(1e9).toFixed(9),
      });
    } catch (error) {
      console.error("Failed to get transmutation prediction:", error);
      throw new Error("Failed to calculate transmutation amount");
    }

    // Format the output amount
    const formattedOutput = formatMicroNumber(convertFromDecimals(willGet));
    console.log("🔍 [DEBUG] TRANSMUTATION FORMATTED", {
      rawOutput: willGet.toString(),
      convertedFromDecimals: convertFromDecimals(willGet).toString(),
      formattedOutput,
      display: formattedOutput.display,
      tooltip: formattedOutput.tooltip,
    });

    // Get fee prediction with proper error handling
    let fees;
    try {
      fees =
        fromTokenSymbol === "GAUC"
          ? await gluonInstance.getTotalFeeAmountTransmuteToGold(gluonBox, oracleBox, Number(inputAmount))
          : await gluonInstance.getTotalFeeAmountTransmuteFromGold(gluonBox, oracleBox, Number(inputAmount));
    } catch (error) {
      console.error("Failed to get transmutation fees:", error);
      throw new Error("Failed to calculate transmutation fees");
    }

    const receiptDetails: ReceiptDetails = {
      inputAmount: numValue,
      outputAmount: {
        gau: fromTokenSymbol === "GAUC" ? parseFloat(formattedOutput.display) : numValue,
        gauc: fromTokenSymbol === "GAU" ? parseFloat(formattedOutput.display) : numValue,
        erg: 0,
      },
      fees: {
        devFee: nanoErgsToErgs(fees.devFee),
        uiFee: nanoErgsToErgs(fees.uiFee),
        oracleFee: nanoErgsToErgs(fees.oracleFee),
        minerFee: nanoErgsToErgs(fees.minerFee),
        totalFee: nanoErgsToErgs(fees.totalFee),
      },
    };

    console.log("🔍 [DEBUG] FINAL OUTPUT", {
      gauAmount: fromTokenSymbol === "GAUC" ? formattedOutput.display : value,
      gaucAmount: fromTokenSymbol === "GAU" ? formattedOutput.display : value,
      toAmount: formattedOutput.display,
      receiptDetails,
    });

    return {
      gauAmount: fromTokenSymbol === "GAUC" ? formattedOutput.display : value,
      gaucAmount: fromTokenSymbol === "GAU" ? formattedOutput.display : value,
      toAmount: formattedOutput.display,
      receiptDetails,
      maxErgOutput: "0", // Transmutation doesn't involve ERG, so this is always 0
    };
  } catch (error) {
    console.error("Error calculating transmutation amounts:", error);

    // Use the error handler for proper classification
    const errorDetails = handleCalculationError(error, "transmutation");

    return {
      error: errorDetails.userMessage,
      resetValues: {
        gauAmount: "0",
        gaucAmount: "0",
        toAmount: "0",
      },
    };
  }
};

export const handleTransmuteToGoldSwap = async ({
  gluonInstance,
  gluonBoxJs,
  oracleBoxJs,
  userBoxes,
  nodeService,
  ergoWallet,
  amount,
}: {
  gluonInstance: any;
  gluonBoxJs: any;
  oracleBoxJs: any;
  userBoxes: any[];
  nodeService: any;
  ergoWallet: any;
  amount: string;
}): Promise<{ txHash?: string; error?: string }> => {
  try {
    console.log("🔍 TRANSMUTE TO GOLD SWAP INPUT:", {
      amount,
      type: typeof amount,
    });

    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    // Validate inputs
    if (!gluonInstance || !gluonBoxJs || !oracleBoxJs) {
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

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    const oracleBuyBackJs = await gluonInstance.getOracleBuyBackBoxJs();
    if (!oracleBuyBackJs) {
      throw new Error("Failed to get oracle buyback box");
    }

    const protonsToTransmute = convertToDecimals(amount);
    console.log("🔍 TRANSMUTE TO GOLD AMOUNT:", {
      protonsToTransmute: protonsToTransmute.toString(),
    });

    // Create unsigned transaction
    const unsignedTransaction = await gluonInstance.transmuteToGoldForEip12(gluonBoxJs, oracleBoxJs, userBoxes, oracleBuyBackJs, Number(protonsToTransmute), height);

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
    handleTransactionSuccess(txHash, "transmute to gold");

    return { txHash };
  } catch (error) {
    console.error("TransmuteToGold failed:", error);

    // Use the error handler for proper classification and toast notification
    const errorDetails = handleTransactionError(error, "transmute to gold");

    return { error: errorDetails.userMessage };
  }
};

export const handleTransmuteFromGoldSwap = async ({
  gluonInstance,
  gluonBoxJs,
  oracleBoxJs,
  userBoxes,
  nodeService,
  ergoWallet,
  amount,
}: {
  gluonInstance: any;
  gluonBoxJs: any;
  oracleBoxJs: any;
  userBoxes: any[];
  nodeService: any;
  ergoWallet: any;
  amount: string;
}): Promise<{ txHash?: string; error?: string }> => {
  try {
    console.log("🔍 TRANSMUTE FROM GOLD SWAP INPUT:", {
      amount,
      type: typeof amount,
    });

    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    // Validate inputs
    if (!gluonInstance || !gluonBoxJs || !oracleBoxJs) {
      throw new Error("Required boxes not initialized");
    }

    if (!ergoWallet) {
      throw new Error("Wallet not connected");
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Invalid amount entered");
    }

    const height = await nodeService.getNetworkHeight();
    if (!height) {
      throw new Error("Failed to get network height");
    }

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    const oracleBuyBackJs = await gluonInstance.getOracleBuyBackBoxJs();
    if (!oracleBuyBackJs) {
      throw new Error("Failed to get oracle buyback box");
    }

    const neutronsToDecay = convertToDecimals(amount);
    console.log("🔍 TRANSMUTE FROM GOLD AMOUNT:", {
      neutronsToDecay: neutronsToDecay.toString(),
    });

    // Create unsigned transaction
    const unsignedTransaction = await gluonInstance.transmuteFromGoldForEip12(gluonBoxJs, oracleBoxJs, userBoxes, oracleBuyBackJs, Number(neutronsToDecay), height);

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
    handleTransactionSuccess(txHash, "transmute from gold");

    return { txHash };
  } catch (error) {
    console.error("TransmuteFromGold failed:", error);

    // Use the error handler for proper classification and toast notification
    const errorDetails = handleTransactionError(error, "transmute from gold");

    return { error: errorDetails.userMessage };
  }
};

/**
 * Validates box format to ensure compatibility with SDK
 */
const validateBoxFormat = (box: any): boolean => {
  return !!(
    box &&
    typeof box.boxId === 'string' &&
    (typeof box.value === 'number' || typeof box.value === 'bigint' || typeof box.value === 'string') &&
    typeof box.ergoTree === 'string' &&
    Array.isArray(box.assets) &&
    box.additionalRegisters &&
    typeof box.additionalRegisters === 'object'
  );
};

/**
 * ErgoPay Transmute To Gold Handler - Returns reduced transaction for mobile wallet signing
 * Transmutes GAUC (protons) to GAU (neutrons)
 * 
 * NOTE: This implementation uses the SAME `transmuteToGold()` method as browser wallet internally.
 * transmuteToGoldForEip12() just calls transmuteToGold() and converts format - transaction logic is IDENTICAL.
 */
export const handleTransmuteToGoldSwapErgoPay = async ({
  gluonInstance,
  gluonBoxJs,
  oracleBoxJs,
  userAddress,
  nodeService,
  amount,
}: {
  gluonInstance: any;
  gluonBoxJs: any;
  oracleBoxJs: any;
  userAddress: string;
  nodeService: any;
  amount: string;
}): Promise<{ txId?: string; reducedTx?: string; error?: string }> => {
  try {
    console.log("🔍 ERGOPAY TRANSMUTE TO GOLD INPUT:", {
      userAddress,
      amount,
      type: typeof amount,
    });

    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    // Validate inputs
    if (!gluonInstance || !gluonBoxJs || !oracleBoxJs) {
      throw new Error("Required boxes not initialized");
    }

    if (!userAddress) {
      throw new Error("User address required for ErgoPay");
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Invalid amount entered");
    }

    const height = await nodeService.getNetworkHeight();
    if (!height) {
      throw new Error("Failed to get network height");
    }

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    const oracleBuyBackJs = await gluonInstance.getOracleBuyBackBoxJs();
    if (!oracleBuyBackJs) {
      throw new Error("Failed to get oracle buyback box");
    }

    const protonsToTransmute = convertToDecimals(amount);
    console.log("🔍 ERGOPAY TRANSMUTE TO GOLD AMOUNT:", {
      protonsToTransmute: protonsToTransmute.toString(),
    });

    // Fetch user boxes from explorer instead of wallet
    console.log("Fetching user boxes from explorer...");
    const userBoxesResponse = await explorerClient.getApiV1AddressesP1Boxes(userAddress);
    const userBoxes = userBoxesResponse.data.items || [];

    if (!userBoxes || userBoxes.length === 0) {
      throw new Error("No unspent boxes found for address. Please ensure your wallet has funds.");
    }

    console.log(`Found ${userBoxes.length} boxes for user`);

    // Validate box format for safety
    const invalidBoxes = userBoxes.filter((box: any) => !validateBoxFormat(box));
    if (invalidBoxes.length > 0) {
      console.error("Invalid box format detected:", invalidBoxes);
      throw new Error(`Invalid box format from explorer API. This should not happen - please report this issue.`);
    }
    console.log("✅ All boxes validated successfully");

    // Create unsigned transaction in EIP-12 JSON format for ErgoPay
    console.log("Creating unsigned transaction (EIP-12 JSON)...");
    const unsignedTransaction = await gluonInstance.transmuteToGoldForEip12(
      gluonBoxJs,
      oracleBoxJs,
      userBoxes,
      oracleBuyBackJs,
      Number(protonsToTransmute),
      height
    );

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Reducing transaction for ErgoPay...");

    // Reduce transaction using WASM
    const [txId, reducedTx] = await getTxReducedB64Safe(unsignedTransaction, explorerClient);

    console.log("Transaction reduced successfully. TxId:", txId);

    return { txId, reducedTx };
  } catch (error) {
    console.error("ErgoPay transmute to gold failed:", error);

    // Use the error handler for proper classification
    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();    const errorDetails = handleTransactionError(error, "transmute to gold", false);

    return { error: errorDetails.userMessage };
  }
};

/**
 * ErgoPay Transmute From Gold Handler - Returns reduced transaction for mobile wallet signing
 * Transmutes GAU (neutrons) to GAUC (protons)
 * 
 * NOTE: This implementation uses the SAME `transmuteFromGold()` method as browser wallet internally.
 * transmuteFromGoldForEip12() just calls transmuteFromGold() and converts format - transaction logic is IDENTICAL.
 */
export const handleTransmuteFromGoldSwapErgoPay = async ({
  gluonInstance,
  gluonBoxJs,
  oracleBoxJs,
  userAddress,
  nodeService,
  amount,
}: {
  gluonInstance: any;
  gluonBoxJs: any;
  oracleBoxJs: any;
  userAddress: string;
  nodeService: any;
  amount: string;
}): Promise<{ txId?: string; reducedTx?: string; error?: string }> => {
  try {
    console.log("🔍 ERGOPAY TRANSMUTE FROM GOLD INPUT:", {
      userAddress,
      amount,
      type: typeof amount,
    });

    // Fetch fresh boxes to avoid stale data issues
    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    // Validate inputs
    if (!gluonInstance || !gluonBoxJs || !oracleBoxJs) {
      throw new Error("Required boxes not initialized");
    }

    if (!userAddress) {
      throw new Error("User address required for ErgoPay");
    }

    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Invalid amount entered");
    }

    const height = await nodeService.getNetworkHeight();
    if (!height) {
      throw new Error("Failed to get network height");
    }

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    const oracleBuyBackJs = await gluonInstance.getOracleBuyBackBoxJs();
    if (!oracleBuyBackJs) {
      throw new Error("Failed to get oracle buyback box");
    }

    const neutronsToDecay = convertToDecimals(amount);
    console.log("🔍 ERGOPAY TRANSMUTE FROM GOLD AMOUNT:", {
      neutronsToDecay: neutronsToDecay.toString(),
    });

    // Fetch user boxes from explorer instead of wallet
    console.log("Fetching user boxes from explorer...");
    const userBoxesResponse = await explorerClient.getApiV1AddressesP1Boxes(userAddress);
    const userBoxes = userBoxesResponse.data.items || [];

    if (!userBoxes || userBoxes.length === 0) {
      throw new Error("No unspent boxes found for address. Please ensure your wallet has funds.");
    }

    console.log(`Found ${userBoxes.length} boxes for user`);

    // Validate box format for safety
    const invalidBoxes = userBoxes.filter((box: any) => !validateBoxFormat(box));
    if (invalidBoxes.length > 0) {
      console.error("Invalid box format detected:", invalidBoxes);
      throw new Error(`Invalid box format from explorer API. This should not happen - please report this issue.`);
    }
    console.log("✅ All boxes validated successfully");

    // Create unsigned transaction in EIP-12 JSON format for ErgoPay
    console.log("Creating unsigned transaction (EIP-12 JSON)...");
    const unsignedTransaction = await gluonInstance.transmuteFromGoldForEip12(
      gluonBoxJs,
      oracleBoxJs,
      userBoxes,
      oracleBuyBackJs,
      Number(neutronsToDecay),
      height
    );

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Reducing transaction for ErgoPay...");

    // Reduce transaction using WASM
    const [txId, reducedTx] = await getTxReducedB64Safe(unsignedTransaction, explorerClient);

    console.log("Transaction reduced successfully. TxId:", txId);

    return { txId, reducedTx };
  } catch (error) {
    console.error("ErgoPay transmute from gold failed:", error);

    // Use the error handler for proper classification
    const errorDetails = handleTransactionError(error, "transmute from gold", false);

    return { error: errorDetails.userMessage };
  }
};
