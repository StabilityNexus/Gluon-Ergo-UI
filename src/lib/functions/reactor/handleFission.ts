import { SwapResult, SwapError, ReceiptDetails } from "./types";
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs } from "@/lib/utils/erg-converter";
import { formatMicroNumber } from "@/lib/utils/erg-converter";
import { handleTransactionError, handleTransactionSuccess, handleCalculationError } from "@/lib/utils/error-handler";
import { getTxReducedB64Safe } from "@/lib/utils/ergopay-tx-reducer";
import { explorerClient } from "@/lib/utils/explorer-client";

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

    const ergToFission = ergsToNanoErgs(numValue);
    console.log("🔍 FISSION ERG CONVERSION:", {
      ergToFission: ergToFission.toString(),
      type: typeof ergToFission,
    });

    const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(ergToFission));
    console.log("🔍 FISSION PREDICTION RAW:", willGet);

    if (!willGet) {
      throw new Error("Failed to get fission prediction from SDK");
    }

    const formattedGau = formatMicroNumber(convertFromDecimals(willGet.neutrons));
    const formattedGauc = formatMicroNumber(convertFromDecimals(willGet.protons));
    console.log("🔍 FISSION FORMATTED:", {
      gau: formattedGau,
      gauc: formattedGauc,
      rawNeutrons: willGet.neutrons.toString(),
      rawProtons: willGet.protons.toString(),
    });

    const fees = await gluonInstance.getTotalFeeAmountFission(gluonBox, Number(ergToFission));
    console.log("🔍 FISSION FEES:", fees);

    const receiptDetails: ReceiptDetails = {
      inputAmount: numValue,
      outputAmount: {
        gau: convertFromDecimals(willGet.neutrons),
        gauc: convertFromDecimals(willGet.protons),
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

    return {
      gauAmount: formattedGau.display,
      gaucAmount: formattedGauc.display,
      toAmount: "0", 
      receiptDetails,
      maxErgOutput: "0",
    };
  } catch (error) {
    console.error("Error calculating fission amounts:", error);

    const errorDetails = handleCalculationError(error, "fission");

    return {
      error: errorDetails.userMessage,
      resetValues: {
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

    if (!gluonInstance || !gluonBox || !oracleBox) {
      throw new Error("Required boxes not initialized");
    }

    if (!ergoWallet) {
      throw new Error("Wallet not connected. Please disconnect and reconnect your wallet.");
    }

    if (!ergoWallet.sign_tx || !ergoWallet.submit_tx) {
      throw new Error("Wallet API not fully initialized. Please refresh the page and reconnect.");
    }

    const nanoErgsToFission = ergsToNanoErgs(amount);
    console.log("🔍 FISSION NANO ERGS:", {
      nanoErgsToFission: nanoErgsToFission.toString(),
      type: typeof nanoErgsToFission,
    });

    const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(nanoErgsToFission));
    console.log("🔍 FISSION WILL GET:", {
      neutrons: willGet.neutrons.toString(),
      protons: willGet.protons.toString(),
    });

    if (!willGet || (willGet.neutrons === 0 && willGet.protons === 0)) {
      throw new Error("Invalid fission amount - no tokens will be generated");
    }

    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    const unsignedTransaction = await gluonInstance.fissionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, Number(nanoErgsToFission));

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Signing and submitting transaction...");

    const signature = await ergoWallet?.sign_tx(unsignedTransaction);
    if (!signature) {
      throw new Error("Failed to sign transaction");
    }

    const txHash = await ergoWallet?.submit_tx(signature);
    if (!txHash) {
      throw new Error("Failed to submit transaction");
    }

    console.log("Transaction submitted successfully. TxId:", txHash);

    handleTransactionSuccess(txHash, "fission");

    return { txHash };
  } catch (error) {
    console.error("Fission failed:", error);

    const errorDetails = handleTransactionError(error, "fission");

    return { error: errorDetails.userMessage };
  }
};

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

export const handleFissionSwapErgoPay = async (
  gluonInstance: any,
  gluonBox: any,
  oracleBox: any,
  userAddress: string,
  amount: string
): Promise<{ txId?: string; reducedTx?: string; error?: string }> => {
  try {
    console.log("🔍 ERGOPAY FISSION INPUT:", {
      userAddress,
      amount,
      type: typeof amount,
    });

    if (!gluonInstance || !gluonBox || !oracleBox) {
      throw new Error("Required boxes not initialized");
    }

    if (!userAddress) {
      throw new Error("User address required for ErgoPay");
    }

    const nanoErgsToFission = ergsToNanoErgs(amount);
    console.log("🔍 ERGOPAY FISSION NANO ERGS:", {
      nanoErgsToFission: nanoErgsToFission.toString(),
    });

    const willGet = await gluonInstance.fissionWillGet(gluonBox, Number(nanoErgsToFission));
    console.log("🔍 ERGOPAY FISSION WILL GET:", {
      neutrons: willGet.neutrons.toString(),
      protons: willGet.protons.toString(),
    });

    if (!willGet || (willGet.neutrons === 0 && willGet.protons === 0)) {
      throw new Error("Invalid fission amount - no tokens will be generated");
    }

    const oracleBoxJs = await gluonInstance.getGoldOracleBox();
    const gluonBoxJs = await gluonInstance.getGluonBox();

    if (!oracleBoxJs || !gluonBoxJs) {
      throw new Error("Failed to get fresh protocol boxes");
    }

    console.log("Fetching user boxes from explorer...");
    const userBoxesResponse = await explorerClient.getApiV1AddressesP1Boxes(userAddress);
    const userBoxes = userBoxesResponse.data.items || [];

    if (!userBoxes || userBoxes.length === 0) {
      throw new Error("No unspent boxes found for address. Please ensure your wallet has funds.");
    }

    console.log(`Found ${userBoxes.length} boxes for user`);

    const invalidBoxes = userBoxes.filter((box: any) => !validateBoxFormat(box));
    if (invalidBoxes.length > 0) {
      console.error("Invalid box format detected:", invalidBoxes);
      throw new Error(`Invalid box format from explorer API. This should not happen - please report this issue.`);
    }
    console.log("✅ All boxes validated successfully");

    console.log("Creating unsigned transaction (EIP-12 JSON)...");
    const unsignedTransaction = await gluonInstance.fissionForEip12(
      gluonBoxJs,
      oracleBoxJs,
      userBoxes,
      Number(nanoErgsToFission)
    );

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Reducing transaction for ErgoPay...");

    const [txId, reducedTx] = await getTxReducedB64Safe(unsignedTransaction, explorerClient);

    console.log("Transaction reduced successfully. TxId:", txId);

    return { txId, reducedTx };
  } catch (error) {
    console.error("ErgoPay fission failed:", error);

    const errorDetails = handleTransactionError(error, "fission", false);

    return { error: errorDetails.userMessage };
  }
};
