import { SwapResult, SwapError, ReceiptDetails } from "./types";
import { convertFromDecimals, nanoErgsToErgs, ergsToNanoErgs, convertToDecimals } from "@/lib/utils/erg-converter";
import { handleTransactionError, handleTransactionSuccess, handleCalculationError } from "@/lib/utils/error-handler";
import { getTxReducedB64Safe } from "@/lib/utils/ergopay-tx-reducer";
import { explorerClient } from "@/lib/utils/explorer-client";
import BigNumber from "bignumber.js";

interface FusionParams {
  gluonInstance: any;
  gluonBox: any;
  value: string;
  gauBalance: string;
  gaucBalance: string;
}

const calculateMaxErgOutput = async (gluonInstance: any, gluonBox: any, gauBalance: string, gaucBalance: string): Promise<BigNumber> => {
  try {
    const gauAmount = BigInt(convertToDecimals(gauBalance));
    const gaucAmount = BigInt(convertToDecimals(gaucBalance));

    console.log("Input Validation:", {
      displayValues: {
        gau: gauBalance,
        gauc: gaucBalance,
      },
      nanoValues: {
        gauNano: gauAmount.toString(),
        gaucNano: gaucAmount.toString(),
      },
    });

    const oneErg = BigInt(1e9);
    const _fusionNeedRes = await gluonInstance.fusionWillNeed(gluonBox, Number(oneErg));
    const { neutrons: neutronsForOneErg, protons: protonsForOneErg } = _fusionNeedRes;

    const neutronsNeeded = BigInt(neutronsForOneErg);
    const protonsNeeded = BigInt(protonsForOneErg);

    const maxFromGau = (gauAmount * oneErg) / neutronsNeeded;
    const maxFromGauc = (gaucAmount * oneErg) / protonsNeeded;
    const maxPossibleNanoErgs = maxFromGau < maxFromGauc ? maxFromGau : maxFromGauc;

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

export const calculateFusionAmounts = async ({ gluonInstance, gluonBox, value, gauBalance, gaucBalance }: FusionParams): Promise<SwapResult | SwapError> => {
  try {
    const maxNanoErgs = await calculateMaxErgOutput(gluonInstance, gluonBox, gauBalance, gaucBalance);
    const maxErgStr = maxNanoErgs.dividedBy(1e9).toFixed();

    const desiredNanoErgs = BigInt(ergsToNanoErgs(value));

    const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(desiredNanoErgs));

    const requiredGau = convertFromDecimals(BigInt(neutrons)).toString();
    const requiredGauc = convertFromDecimals(BigInt(protons)).toString();

    const fees = await gluonInstance.getTotalFeeAmountFusion(gluonBox, Number(desiredNanoErgs));

    const receiptDetails: ReceiptDetails = {
      inputAmount: parseFloat(requiredGau),
      outputAmount: {
        gau: parseFloat(requiredGau),
        gauc: parseFloat(requiredGauc),
        erg: parseFloat(value),
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
      gauAmount: requiredGau,
      gaucAmount: requiredGauc,
      toAmount: value,
      maxErgOutput: maxErgStr,
      receiptDetails,
    };
  } catch (error) {
    console.error("Error calculating fusion amounts:", error);

    const errorDetails = handleCalculationError(error, "fusion");

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

    if (!gluonInstance || !gluonBox || !oracleBox) {
      throw new Error("Required boxes not initialized");
    }

    if (!ergoWallet) {
      throw new Error("Wallet not connected. Please disconnect and reconnect your wallet.");
    }

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

    const nanoErgsToFuse = ergsToNanoErgs(amount);
    console.log("amount to nano ergs", nanoErgsToFuse);

    const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(nanoErgsToFuse));
    console.log("neutrons", neutrons);
    console.log("protons", protons);

    if (!neutrons || !protons || neutrons <= 0 || protons <= 0) {
      throw new Error("Invalid fusion amounts - insufficient tokens required");
    }

    const requiredGau = convertFromDecimals(BigInt(neutrons)).toString();
    const requiredGauc = convertFromDecimals(BigInt(protons)).toString();

    console.log("Transaction Value Verification:", {
      input: {
        requestedErg: amount,
        nanoErgsToFuse: nanoErgsToFuse.toString(),
      },
      tokensToBeConsumed: {
        rawNeutrons: neutrons.toString(),
        rawProtons: protons.toString(),
        displayGau: requiredGau,
        displayGauc: requiredGauc,
      },
    });

    const unsignedTransaction = await gluonInstance.fusionForEip12(gluonBoxJs, oracleBoxJs, userBoxes, Number(nanoErgsToFuse));

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

    handleTransactionSuccess(txHash, "fusion");

    return { txHash };
  } catch (error) {
    console.error("Fusion failed:", error);

    const errorDetails = handleTransactionError(error, "fusion");

    return { error: errorDetails.userMessage };
  }
};

const validateBoxFormat = (box: any): boolean => {
  return !!(
    box &&
    typeof box.boxId === 'string' &&
    (typeof box.value === 'number' || typeof box.value === 'bigint') &&
    typeof box.ergoTree === 'string' &&
    Array.isArray(box.assets) &&
    typeof box.additionalRegisters === 'object'
  );
};

export const handleFusionSwapErgoPay = async (
  gluonInstance: any,
  gluonBox: any,
  oracleBox: any,
  userAddress: string,
  amount: string,
  nodeService: any
): Promise<{ txId?: string; reducedTx?: string; error?: string }> => {
  try {
    console.log("🔍 ERGOPAY FUSION INPUT:", {
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
      throw new Error("Failed to get fresh protocol boxes");
    }

    const nanoErgsToFuse = ergsToNanoErgs(amount);
    console.log("🔍 ERGOPAY FUSION NANO ERGS:", {
      nanoErgsToFuse: nanoErgsToFuse.toString(),
    });

    const { neutrons, protons } = await gluonInstance.fusionWillNeed(gluonBox, Number(nanoErgsToFuse));
    console.log("🔍 ERGOPAY FUSION WILL NEED:", {
      neutrons: neutrons.toString(),
      protons: protons.toString(),
    });

    if (!neutrons || !protons || neutrons <= 0 || protons <= 0) {
      throw new Error("Invalid fusion amounts - insufficient tokens required");
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
    const unsignedTransaction = await gluonInstance.fusionForEip12(
      gluonBoxJs,
      oracleBoxJs,
      userBoxes,
      Number(nanoErgsToFuse)
    );

    if (!unsignedTransaction) {
      throw new Error("Failed to create unsigned transaction");
    }

    console.log("Reducing transaction for ErgoPay...");

    const [txId, reducedTx] = await getTxReducedB64Safe(unsignedTransaction, explorerClient);

    console.log("Transaction reduced successfully. TxId:", txId);

    return { txId, reducedTx };
  } catch (error) {
    console.error("ErgoPay fusion failed:", error);

    const errorDetails = handleTransactionError(error, "fusion");

    return { error: errorDetails.userMessage };
  }
};
