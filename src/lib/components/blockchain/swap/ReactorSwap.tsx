"use client";

import { Button } from "@/lib/components/ui/button";
import { Card, CardContent, CardHeader } from "@/lib/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/lib/components/ui/select";
import { Separator } from "@/lib/components/ui/separator";
import { Settings2 } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/utils";
import { useErgo } from "@/lib/providers/ErgoProvider";
import { NumericFormat, type NumberFormatValues } from "react-number-format";
import { NodeService } from "@/lib/utils/node-service";
import { TOKEN_ADDRESS } from "@/lib/constants/token";
import { convertFromDecimals, formatMicroNumber, nanoErgsToErgs, convertToDecimals } from "@/lib/utils/erg-converter";
import { createTransactionListener, type WalletState, type ExpectedChanges } from "@/lib/utils/transaction-listener";
import BigNumber from "bignumber.js";
import { Token, TokenSymbol, ReceiptDetails } from "@/lib/functions/reactor/types";
import { defaultTokens, getValidToTokens, getActionType, getDescription, getTitle, formatValue } from "@/lib/functions/reactor/utils";
import { calculateFissionAmounts, handleFissionSwap } from "@/lib/functions/reactor/handleFission";
import { calculateFusionAmounts, handleFusionSwap } from "@/lib/functions/reactor/handleFusion";
import { calculateTransmutationAmounts, handleTransmuteToGoldSwap, handleTransmuteFromGoldSwap } from "@/lib/functions/reactor/handleTransmutation";
import { debounce } from "lodash";
import { handleInitializationError } from "@/lib/utils/error-handler";
import ErgIcon from "@/lib/components/icons/ErgIcon";
import GauIcon from "@/lib/components/icons/GauIcon";
import GaucIcon from "@/lib/components/icons/GaucIcon";
import GauGaucIcon from "@/lib/components/icons/GauGaucIcon";
import { motion, AnimatePresence } from "framer-motion";

const formatTokenAmount = (value: number | string): string => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (!numValue) return "0";

  // Handle scientific notation
  if (typeof value === 'string' && value.includes('e')) {
    const bn = new BigNumber(value);
    return bn.decimalPlaces(9, BigNumber.ROUND_DOWN).toFixed();
  }

  // Format all tokens with up to 9 decimal places (removing trailing zeros)
  const bn = new BigNumber(value.toString());
  const formatted = bn.decimalPlaces(9, BigNumber.ROUND_DOWN).toFixed();
  
  // Remove trailing zeros after decimal point
  const parts = formatted.split('.');
  if (parts.length === 2) {
    const trimmed = parts[1].replace(/0+$/, '');
    return trimmed ? `${parts[0]}.${trimmed}` : parts[0];
  }
  return formatted;
}

// Helper function to check if two values are equal within precision tolerance
/*const isPreciselyEqual = (value1: string, value2: string): boolean => {
  try {
    const bn1 = new BigNumber(value1 || "0");
    const bn2 = new BigNumber(value2 || "0");
    return bn1.isEqualTo(bn2);
  } catch (error) {
    console.error("Error in precision comparison:", error);
    return false;
  }
}*/

// NEW: Value management system for display vs precise values
const createValuePair = (preciseValue: string) => {
  const bn = new BigNumber(preciseValue || "0");
  if (bn.isZero()) return { display: "0", precise: "0" };

  // For display: Clean formatting with reasonable decimals
  const displayValue = bn.decimalPlaces(4, BigNumber.ROUND_DOWN).toFixed();

  return {
    display: displayValue,
    precise: preciseValue,
  };
};

// Check if user input matches our precise MAX value (within tolerance)
const isUserInputMaxValue = (userInput: string, preciseMax: string): boolean => {
  try {
    const userBN = new BigNumber(userInput || "0");
    const maxBN = new BigNumber(preciseMax || "0");
    const difference = userBN.minus(maxBN).abs();
    const tolerance = new BigNumber("0.0001");

    return difference.isLessThanOrEqualTo(tolerance);
  } catch (error) {
    console.log(error);
    return false;
  }
};

// Add a new function specifically for ERG formatting - no thousand separators for input compatibility
const formatErgAmount = (value: number | string | BigNumber): string => {
  const bn = new BigNumber(value.toString());
  // Return plain number string without thousand separators to avoid parsing issues
  return bn.decimalPlaces(9, BigNumber.ROUND_DOWN).toFixed();
}

export function ReactorSwap() {
  const { isConnected, getBalance, getUtxos, ergoWallet } = useErgo();
  const [tokens, setTokens] = useState<Token[]>(defaultTokens);
  const [fromToken, setFromToken] = useState<Token>(tokens[0]);
  const [toToken, setToToken] = useState<Token>(tokens[3]);
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [gauAmount, setGauAmount] = useState<string>("0");
  const [gaucAmount, setGaucAmount] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [gluonInstance, setGluonInstance] = useState<any>(null);
  const [gluonBox, setGluonBox] = useState<any>(null);
  const [oracleBox, setOracleBox] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [nodeService] = useState(() => new NodeService(process.env.NEXT_PUBLIC_NODE || ""));
  const [balanceUpdateTrigger] = useState(0);
  const [boxesReady, setBoxesReady] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetails>({
    inputAmount: 0,
    outputAmount: { gau: 0, gauc: 0, erg: 0 },
    fees: {
      devFee: 0,
      uiFee: 0,
      oracleFee: 0,
      minerFee: 0,
      totalFee: 0,
    },
  });
  const [maxErgOutput, setMaxErgOutput] = useState<string>("0");
  const [maxErgOutputPrecise, setMaxErgOutputPrecise] = useState<string>("0"); // Precise value for calculations
  //const [isUpdatingProgrammatically, setIsUpdatingProgrammatically] = useState(false)
  const updateBalancesRef = useRef(() => {});

  // Transaction listener state
  const [transactionListener] = useState(() => createTransactionListener(nodeService));
  const [hasPendingTransactions, setHasPendingTransactions] = useState(false);

  // Helper function to capture current wallet state
  const captureWalletState = async (): Promise<WalletState> => {
    const balances = await getBalance();
    const ergBalance = balances.find((b: any) => b.tokenId === "ERG" || !b.tokenId)?.balance || "0";
    const gauBalance = balances.find((b: any) => b.tokenId === TOKEN_ADDRESS.gau)?.balance || "0";
    const gaucBalance = balances.find((b: any) => b.tokenId === TOKEN_ADDRESS.gauc)?.balance || "0";

    return {
      erg: ergBalance,
      gau: gauBalance,
      gauc: gaucBalance,
      timestamp: Date.now(),
    };
  };

  // Helper function to calculate expected changes based on transaction type
  const calculateExpectedChanges = (
    actionType: string,
    inputAmount: string,
    outputAmounts: { gau?: string; gauc?: string; erg?: string },
    fees: number | BigNumber
  ): ExpectedChanges => {
    const feeAmount = typeof fees === "number" ? fees : fees.toNumber();
    const changes: ExpectedChanges = {
      erg: "0",
      gau: "0",
      gauc: "0",
      fees: (-Math.abs(feeAmount * 1000000000)).toString(), // Convert to nanoERGs and make negative
    };

    switch (actionType) {
      case "fission":
        // ERG → GAU + GAUC
        changes.erg = (-parseFloat(inputAmount) * 1000000000).toString(); // Input ERG converted to nanoERGs and negative
        changes.gau = convertToDecimals(outputAmounts.gau || "0").toString();
        changes.gauc = convertToDecimals(outputAmounts.gauc || "0").toString();
        break;

      case "fusion":
        // GAU + GAUC → ERG
        changes.erg = (parseFloat(outputAmounts.erg || "0") * 1000000000).toString(); // Output ERG to nanoERGs
        changes.gau = (-convertToDecimals(gauAmount)).toString(); // Used GAU tokens
        changes.gauc = (-convertToDecimals(gaucAmount)).toString(); // Used GAUC tokens
        break;

      case "transmute-to-gold":
        // GAUC → GAU
        changes.gauc = (-convertToDecimals(inputAmount)).toString();
        changes.gau = convertToDecimals(outputAmounts.gau || "0").toString();
        break;

      case "transmute-from-gold":
        // GAU → GAUC
        changes.gau = (-convertToDecimals(inputAmount)).toString();
        changes.gauc = convertToDecimals(outputAmounts.gauc || "0").toString();
        break;
    }

    return changes;
  };

  const calculateAmounts = async (value: string, isFromInput: boolean) => {
    console.log("🧮 calculateAmounts called with:", {
      value,
      isFromInput,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      boxesReady,
      gluonInstance: !!gluonInstance,
      gluonBox: !!gluonBox,
    });

    if (!boxesReady || !gluonInstance || !gluonBox) {
      console.log("❌ Boxes not ready for calculation");
      return;
    }

    // Reset values if input is invalid
    if (!value || value === "." || (parseFloat(value) === 0 && value !== "0" && value !== "0.")) {
      console.log("⚠️ Invalid input value, resetting");
      setIsCalculating(false);
      setToAmount("");
      setGauAmount("0");
      setGaucAmount("0");
      setReceiptDetails({
        inputAmount: 0,
        outputAmount: { gau: 0, gauc: 0, erg: 0 },
        fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
        maxErgOutput: maxErgOutput,
      });
      return;
    }

    setIsCalculating(true);
    try {
      let result;

      if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
        // Check if user input is equivalent to our max value (use precise for calculation)
        const calculationValue = isUserInputMaxValue(value, maxErgOutputPrecise) ? maxErgOutputPrecise : value;

        console.log("🔄 Calculating Fusion amounts for ERG output:", {
          userInput: value,
          calculationValue: calculationValue,
          isUsingPreciseMax: calculationValue === maxErgOutputPrecise,
          maxDisplay: maxErgOutput,
          maxPrecise: maxErgOutputPrecise,
        });

        result = await calculateFusionAmounts({
          gluonInstance,
          gluonBox,
          value: calculationValue,
          gauBalance: tokens.find((t) => t.symbol === "GAU")?.balance || "0",
          gaucBalance: tokens.find((t) => t.symbol === "GAUC")?.balance || "0",
        });

        if ("error" in result) {
          console.error("❌ Fusion calculation error:", result.error);
          setToAmount("");
          setGauAmount("0");
          setGaucAmount("0");
          return;
        }

        console.log("✅ Fusion calculation result:", {
          gauAmount: result.gauAmount,
          gaucAmount: result.gaucAmount,
          receiptDetails: result.receiptDetails,
        });

        // Update the amounts based on the ERG output target
        setGauAmount(result.gauAmount);
        setGaucAmount(result.gaucAmount);
        setReceiptDetails(result.receiptDetails);
      } else if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
        console.log("🔄 Calculating Fission amounts");
        result = await calculateFissionAmounts({
          gluonInstance,
          gluonBox,
          value: value,
        });

        if ("error" in result) {
          console.error(result.error);
          setToAmount("");
          if (result.resetValues) {
            if (result.resetValues.gauAmount) setGauAmount(result.resetValues.gauAmount);
            if (result.resetValues.gaucAmount) setGaucAmount(result.resetValues.gaucAmount);
          } else {
            setGauAmount("0");
            setGaucAmount("0");
          }
          return;
        }
        const minOutput = Math.min(parseFloat(result.gauAmount), parseFloat(result.gaucAmount));
        setToAmount(isNaN(minOutput) ? "" : minOutput.toString());
        setGauAmount(result.gauAmount);
        setGaucAmount(result.gaucAmount);
        setReceiptDetails(result.receiptDetails);
      } else if ((fromToken.symbol === "GAUC" && toToken.symbol === "GAU") || (fromToken.symbol === "GAU" && toToken.symbol === "GAUC")) {
        // Only calculate if we're changing the input amount
        if (!isFromInput) return;

        result = await calculateTransmutationAmounts({
          gluonInstance,
          gluonBox,
          oracleBox,
          nodeService,
          value: value,
          fromTokenSymbol: fromToken.symbol as TokenSymbol,
        });

        if ("error" in result) {
          console.error("❌ Transmutation calculation error:", result.error);
          setToAmount("");
          return;
        }

        // Simply update the output amount
        setToAmount(result.toAmount);
        setReceiptDetails(result.receiptDetails);
      }
    } catch (error) {
      console.error("Error in calculateAmounts:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const debouncedCalculateAmounts = useCallback(
    debounce(async (val: string, isFrom: boolean) => {
      console.log("🔄 Debounced calculation triggered:", { val, isFrom });
      await calculateAmounts(val, isFrom);
    }, 500),
    [boxesReady, gluonInstance, gluonBox, oracleBox, nodeService, fromToken.symbol, toToken.symbol]
  );

  const handleAmountChange = (inputValues: NumberFormatValues, isFromInput: boolean) => {
    const { value: stringValue, floatValue } = inputValues;
    // Only update the field that was actually changed by the user
    if (isFromInput) {
      setFromAmount(stringValue);
    } else {
      setToAmount(stringValue);
    }
    if (floatValue === undefined || floatValue === 0) {
      setToAmount("");
      setGauAmount("0");
      setGaucAmount("0");
      setReceiptDetails({
        inputAmount: 0,
        outputAmount: { gau: 0, gauc: 0, erg: 0 },
        fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
        maxErgOutput: maxErgOutput,
      });
      debouncedCalculateAmounts.cancel();
      return;
    }
    // For GAU-GAUC to ERG, we need to calculate when the ERG (To) amount changes
    if (!isFromInput && fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      debouncedCalculateAmounts(stringValue, isFromInput);
    } else if (isFromInput) {
      // For all other cases, only calculate when input changes
      debouncedCalculateAmounts(stringValue, isFromInput);
    }
  };

  useEffect(() => {
    const initGluon = async () => {
      setIsInitializing(true);
      setBoxesReady(false);
      setInitError(null);
      try {
        const sdk = await import("gluon-gold-sdk");
        const gluon = new sdk.Gluon();
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet";
        setGluonInstance(gluon);
        const gBox = await gluon.getGluonBox();
        const oBox = await gluon.getGoldOracleBox();
        if (!gBox || !oBox) {
          throw new Error("Failed to initialize Gluon boxes");
        }
        setGluonBox(gBox);
        setOracleBox(oBox);
        setBoxesReady(true);
        console.log("Gluon initialized:", {
          network: gluon.config.NETWORK,
          gluonBox: gBox,
          oracleBox: oBox,
        });
      } catch (error) {
        console.error("Failed to initialize Gluon:", error);
        const errorDetails = handleInitializationError(error, "Gluon", true);
        setInitError(errorDetails.userMessage);
        setBoxesReady(false);
      } finally {
        setIsInitializing(false);
      }
    };
    initGluon();
    const boxRefreshInterval = setInterval(() => {
      if (gluonInstance) initGluon();
    }, 30000);
    return () => clearInterval(boxRefreshInterval);
  }, []);

  const updateBalances = useCallback(async () => {
    if (isConnected) {
      try {
        const balances = await getBalance();
        let updatedTokens = [...tokens].map((token) => {
          const defaultToken = defaultTokens.find((dt) => dt.symbol === token.symbol);
          return { ...token, ...defaultToken };
        });

        if (Array.isArray(balances) && balances.length > 0) {
          const ergBalanceData = balances.find((b) => b.tokenId === "ERG" || !b.tokenId);
          if (ergBalanceData && ergBalanceData.balance) {
            const ergRawBalance = BigInt(ergBalanceData.balance);
            const ergAmount = formatErgAmount(nanoErgsToErgs(ergRawBalance));
            updatedTokens = updatedTokens.map((token) => (token.symbol === "ERG" ? { ...token, balance: ergAmount } : token));
          }

          balances.forEach((tokenBalance) => {
            if (tokenBalance.tokenId === TOKEN_ADDRESS.gau) {
              const gauRawBalance = tokenBalance.balance && tokenBalance.balance !== "NaN" ? BigInt(tokenBalance.balance) : BigInt(0);
              const gauDecimalBalance = convertFromDecimals(gauRawBalance);
              updatedTokens = updatedTokens.map((t) =>
                t.symbol === "GAU"
                  ? {
                      ...t,
                      balance: formatMicroNumber(gauDecimalBalance).display,
                    }
                  : t
              );
            } else if (tokenBalance.tokenId === TOKEN_ADDRESS.gauc) {
              const gaucRawBalance = tokenBalance.balance && tokenBalance.balance !== "NaN" ? BigInt(tokenBalance.balance) : BigInt(0);
              const gaucDecimalBalance = convertFromDecimals(gaucRawBalance);
              updatedTokens = updatedTokens.map((t) =>
                t.symbol === "GAUC"
                  ? {
                      ...t,
                      balance: formatMicroNumber(gaucDecimalBalance).display,
                    }
                  : t
              );
            }
          });

          const gauToken = updatedTokens.find((t) => t.symbol === "GAU");
          const gaucToken = updatedTokens.find((t) => t.symbol === "GAUC");
          if (gauToken && gaucToken) {
            const gauBalanceNum = parseFloat(gauToken.balance);
            const gaucBalanceNum = parseFloat(gaucToken.balance);
            const pairBalanceVal = Math.min(Number.isNaN(gauBalanceNum) ? 0 : gauBalanceNum, Number.isNaN(gaucBalanceNum) ? 0 : gaucBalanceNum);
            const pairBalance = formatTokenAmount(pairBalanceVal.toString());
            updatedTokens = updatedTokens.map((t) => (t.symbol === "GAU-GAUC" ? { ...t, balance: pairBalance } : t));
          }
        }

        setTokens(updatedTokens);

        // Update current tokens while preserving their selection
        const currentFromTokenInUpdated = updatedTokens.find((t) => t.symbol === fromToken.symbol);
        const currentToTokenInUpdated = updatedTokens.find((t) => t.symbol === toToken.symbol);

        if (currentFromTokenInUpdated) {
          setFromToken((prev) => ({
            ...prev,
            balance: currentFromTokenInUpdated.balance,
          }));
        }
        if (currentToTokenInUpdated) {
          setToToken((prev) => ({
            ...prev,
            balance: currentToTokenInUpdated.balance,
          }));
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    }
  }, [isConnected, getBalance, balanceUpdateTrigger, fromToken, toToken]);

  useEffect(() => {
    updateBalancesRef.current = updateBalances;
  }, [updateBalances]);

  useEffect(() => {
    updateBalancesRef.current();
    const pollingInterval = setInterval(() => updateBalancesRef.current(), 30000);
    return () => clearInterval(pollingInterval);
  }, [isConnected, getBalance, balanceUpdateTrigger]);

  // Initialize transaction listener and check for pending transactions
  useEffect(() => {
    if (isConnected) {
      transactionListener.initialize();
      setHasPendingTransactions(transactionListener.hasPendingTransactions());

      // Set up periodic wallet checking for confirmed but not updated transactions
      const walletCheckInterval = setInterval(async () => {
        try {
          await transactionListener.checkWalletUpdates(getBalance);
          setHasPendingTransactions(transactionListener.hasPendingTransactions());
        } catch (error) {
          console.error("Error checking wallet updates:", error);
        }
      }, 20000); // Check every 20 seconds (less aggressive)

      return () => clearInterval(walletCheckInterval);
    }
  }, [isConnected, getBalance, transactionListener]);

  // Add a separate effect for handling connection state changes
  useEffect(() => {
    if (!isConnected) {
      const zeroBalanceTokens = defaultTokens.map((t) => ({
        ...t,
        balance: "0",
      }));
      setTokens(zeroBalanceTokens);
      setFromToken(zeroBalanceTokens[0]);
      setToToken(zeroBalanceTokens[3]);
      setFromAmount("");
      setToAmount("");
      setGauAmount("0");
      setGaucAmount("0");
    }
  }, [isConnected]);

  const handleFromTokenChange = (symbol: string) => {
    const newToken = tokens.find((t) => t.symbol === (symbol as TokenSymbol));
    if (!newToken) return;
    setFromToken(newToken);
    setFromAmount("");
    setToAmount("");
    const validToTokens = getValidToTokens(newToken.symbol, tokens);
    if (!validToTokens.find((t) => t.symbol === toToken.symbol)) {
      setToToken(validToTokens[0]);
    }
    debouncedCalculateAmounts.cancel();
    setReceiptDetails({
      inputAmount: 0,
      outputAmount: { gau: 0, gauc: 0, erg: 0 },
      fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
      maxErgOutput,
    });
  };

  const handleToTokenChange = (symbol: string) => {
    const newToken = tokens.find((t) => t.symbol === (symbol as TokenSymbol));
    if (!newToken) return;
    const validToTokens = getValidToTokens(fromToken.symbol, tokens);
    if (validToTokens.find((t) => t.symbol === newToken.symbol)) {
      setToToken(newToken);
      setToAmount("");
      setFromAmount("");
    }
    debouncedCalculateAmounts.cancel();
    setReceiptDetails({
      inputAmount: 0,
      outputAmount: { gau: 0, gauc: 0, erg: 0 },
      fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
      maxErgOutput,
    });
  };

  const handleSwapTokens = () => {
    const validToTokensForCurrentTo = getValidToTokens(toToken.symbol, tokens);
    if (validToTokensForCurrentTo.find((t) => t.symbol === fromToken.symbol)) {
      const tempFromToken = fromToken;
      const tempToToken = toToken;

      setFromToken(tempToToken);
      setToToken(tempFromToken);

      // Reset all values when switching directions
      setFromAmount("");
      setToAmount("");
      setGauAmount("0");
      setGaucAmount("0");
      setReceiptDetails({
        inputAmount: 0,
        outputAmount: { gau: 0, gauc: 0, erg: 0 },
        fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
        maxErgOutput,
      });

      // Cancel any pending calculations
      debouncedCalculateAmounts.cancel();
    } else {
      console.warn("Cannot swap: current 'To' token cannot be swapped to be the 'From' token leading to current 'From' token as 'To' token");
    }
  };

  const handleMax = async (isFromCard: boolean) => {
    console.log("🔍 handleMax called with:", {
      isFromCard,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      displayValue: maxErgOutput,
      preciseValue: maxErgOutputPrecise,
    });
    if (isFromCard && fromToken.symbol === "GAU-GAUC") {
      console.log("❌ Ignoring MAX for GAU-GAUC in FROM field");
      return;
    }
    let maxAmount = "0";
    if (!isFromCard && fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      maxAmount = maxErgOutput;
      console.log("🎯 Setting MAX for GAU-GAUC to ERG conversion", {
        displayValue: maxErgOutput,
        preciseValue: maxErgOutputPrecise,
        usingForUI: maxAmount,
      });
      setToAmount(maxAmount);
      console.log("🔄 Triggering calculation with precise value:", {
        preciseValue: maxErgOutputPrecise,
      });
      await calculateAmounts(maxErgOutputPrecise, false);
      return;
    }
    if (isFromCard) {
      const balanceNum = parseFloat(fromToken.balance);
      if (isNaN(balanceNum)) {
        setFromAmount("0");
        debouncedCalculateAmounts("0", true);
        return;
      }
      if (fromToken.symbol === "ERG") {
        // Pre-calculate fees for better MAX calculation
        const estimatedTotalFeeERG = 0.011; // Conservative estimate: 0.004 (devFee) + 0.002 (oracle) + 0.003 (miner) + 0.002 buffer
        const ergReserve = 0.1; // Minimum ERG to keep in wallet
        const availableErg = Math.max(0, balanceNum - ergReserve - estimatedTotalFeeERG);
        // Use full precision without rounding
        maxAmount = availableErg.toString();
      } else if (fromToken.symbol === "GAU" || fromToken.symbol === "GAUC") {
        maxAmount = fromToken.balance;
      } 
      setFromAmount(maxAmount);
    }
    if (parseFloat(maxAmount) > 0) {
      await calculateAmounts(maxAmount, isFromCard);
    } else {
      setToAmount("");
      setGauAmount("0");
      setGaucAmount("0");
      setReceiptDetails({
        inputAmount: 0,
        outputAmount: { gau: 0, gauc: 0, erg: 0 },
        fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
        maxErgOutput: maxErgOutput,
      });
    }
  };
  const handleSwap = async () => {
    if (!isConnected || isInitializing || !gluonInstance || !gluonBox || !oracleBox || isLoading || isCalculating || hasPendingTransactions) {
      console.error("Swap prerequisites not met.", {
        isConnected,
        isInitializing,
        gluonInstance: !!gluonInstance,
        gluonBox: !!gluonBox,
        oracleBox: !!oracleBox,
        isLoading,
        isCalculating,
        hasPendingTransactions,
      });
      return;
    }

    setIsLoading(true);

    try {
      // Capture pre-transaction wallet state
      const preTransactionState = await captureWalletState();

      // Determine action type for transaction listener
      let actionType = "";
      let inputAmount = "";
      let outputAmounts = { gau: "", gauc: "", erg: "" };

      if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
        actionType = "fission";
        inputAmount = fromAmount;
        outputAmounts = { gau: gauAmount, gauc: gaucAmount, erg: "0" };
      } else if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
        actionType = "fusion";
        inputAmount = toAmount; // For fusion, we target ERG output
        outputAmounts = { gau: "0", gauc: "0", erg: toAmount };
      } else if (fromToken.symbol === "GAUC" && toToken.symbol === "GAU") {
        actionType = "transmute-to-gold";
        inputAmount = fromAmount;
        outputAmounts = { gau: toAmount, gauc: "0", erg: "0" };
      } else if (fromToken.symbol === "GAU" && toToken.symbol === "GAUC") {
        actionType = "transmute-from-gold";
        inputAmount = fromAmount;
        outputAmounts = { gau: "0", gauc: toAmount, erg: "0" };
      }

      // Calculate expected changes for transaction listener
      const expectedChanges = calculateExpectedChanges(actionType, inputAmount, outputAmounts, receiptDetails.fees.totalFee);

      console.log("🚀 Starting transaction with listener:", {
        actionType,
        preTransactionState,
        expectedChanges,
        inputAmount,
        outputAmounts,
      });

      let result;
      const utxos = await getUtxos();

      if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
        result = await handleFissionSwap(gluonInstance, gluonBox, oracleBox, utxos, nodeService, ergoWallet, fromAmount);
      } else if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
        result = await handleFusionSwap(gluonInstance, gluonBox, oracleBox, utxos, nodeService, ergoWallet, toAmount);
      } else if (fromToken.symbol === "GAUC" && toToken.symbol === "GAU") {
        result = await handleTransmuteToGoldSwap({
          gluonInstance,
          gluonBoxJs: gluonBox,
          oracleBoxJs: oracleBox,
          userBoxes: utxos,
          nodeService,
          ergoWallet,
          amount: fromAmount,
        });
      } else if (fromToken.symbol === "GAU" && toToken.symbol === "GAUC") {
        result = await handleTransmuteFromGoldSwap({
          gluonInstance,
          gluonBoxJs: gluonBox,
          oracleBoxJs: oracleBox,
          userBoxes: utxos,
          nodeService,
          ergoWallet,
          amount: fromAmount,
        });
      }

      if (result && result.error) {
        // Error is already handled by the transaction function with toast
        console.error("Swap failed:", result.error);
        return;
      }

      if (result && result.txHash) {
        // SUCCESS: Save transaction to listener system
        transactionListener.saveUpTransaction(result.txHash, actionType, preTransactionState, expectedChanges);

        setHasPendingTransactions(true);

        console.log("✅ Transaction submitted and saved to listener:", {
          txHash: result.txHash.slice(0, 8) + "...",
          actionType,
        });

        // Reset form immediately (UI responsiveness)
        setFromAmount("");
        setToAmount("");
        setGauAmount("0");
        setGaucAmount("0");
        setReceiptDetails({
          inputAmount: 0,
          outputAmount: { gau: 0, gauc: 0, erg: 0 },
          fees: { devFee: 0, uiFee: 0, oracleFee: 0, minerFee: 0, totalFee: 0 },
          maxErgOutput: maxErgOutput,
        });

        // Don't immediately trigger balance update - let the transaction listener handle it
        // This prevents state conflicts between immediate polling and actual wallet updates
      }
    } catch (error) {
      console.error("Unexpected swap error:", error);
      // This should not happen as errors are handled in transaction functions
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const calculateMaxErgForFusion = async () => {
      if (!boxesReady || !gluonInstance || !gluonBox) return;
      try {
        const gauBalanceStr = tokens.find((t) => t.symbol === "GAU")?.balance || "0";
        const gaucBalanceStr = tokens.find((t) => t.symbol === "GAUC")?.balance || "0";
        const result = await calculateFusionAmounts({
          gluonInstance,
          gluonBox,
          value: "0",
          gauBalance: gauBalanceStr,
          gaucBalance: gaucBalanceStr,
        });
        if (!("error" in result) && result.maxErgOutput) {
          const valuePair = createValuePair(result.maxErgOutput);
          setMaxErgOutput(valuePair.display); // Clean display value
          setMaxErgOutputPrecise(result.maxErgOutput); // Precise calculation value
        } else {
          setMaxErgOutput("0");
          setMaxErgOutputPrecise("0");
        }
      } catch (error) {
        console.error("Error calculating max ERG for Fusion:", error);
        setMaxErgOutput("0");
        setMaxErgOutputPrecise("0");
      }
    };
    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      calculateMaxErgForFusion();
    }
  }, [boxesReady, gluonInstance, gluonBox, tokens, fromToken.symbol, toToken.symbol]);

  // Skeleton loading component
  const renderSkeletonCard = (isFromCard: boolean) => {
    const shimmerKeyframes = `
      @keyframes shimmer {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }
    `;

    return (
      <motion.div
        className="w-full rounded-xl bg-gradient-to-r from-foreground/10 to-muted-foreground/5 p-4 dark:from-white/10 dark:to-white/5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <style>{shimmerKeyframes}</style>

        <motion.div className="mb-2 flex justify-between">
          <div
            className="h-4 w-8 rounded bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]"
            style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
          />
          <div
            className="h-4 w-24 rounded bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]"
            style={{
              animation: "shimmer 1.5s ease-in-out infinite",
              animationDelay: "0.2s",
            }}
          />
        </motion.div>

        <motion.div className="mb-2 flex items-center gap-4">
          {/* Token selector skeleton */}
          <div
            className="h-10 w-[200px] rounded bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]"
            style={{
              animation: "shimmer 1.5s ease-in-out infinite",
              animationDelay: "0.1s",
            }}
          />

          {/* Amount input skeleton */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <div
              className="h-12 w-32 rounded bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]"
              style={{
                animation: "shimmer 1.5s ease-in-out infinite",
                animationDelay: "0.3s",
              }}
            />
            {isFromCard && (
              <div
                className="h-4 w-8 rounded bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]"
                style={{
                  animation: "shimmer 1.5s ease-in-out infinite",
                  animationDelay: "0.4s",
                }}
              />
            )}
          </div>
        </motion.div>

        {/* Loading pulse indicator */}
        <motion.div className="mt-2 flex justify-center" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <span className="text-xs text-muted-foreground">{isFromCard ? "Loading reactor..." : "Preparing swap..."}</span>
        </motion.div>
      </motion.div>
    );
  };

  const renderTokenCard = (isFromCard: boolean) => {
    const currentToken = isFromCard ? fromToken : toToken;
    const currentAmount = isFromCard ? fromAmount : toAmount;
    const currentBalance = parseFloat(currentToken.balance);
    const ergFeeBuffer = 0.1;

    // Use full precision (9 decimals) for all tokens
    let effectiveDecimalScale = 9;

    const isInputDisabled = !boxesReady || isCalculating || (isInitializing && !boxesReady);
    const shouldRenderInputOrDisplay = currentToken.symbol !== "GAU-GAUC";

    // Helper function to get token icon
    const getTokenIcon = (symbol: string, className: string = "w-6 h-6") => {
      switch (symbol) {
        case "ERG":
          return <ErgIcon className={cn(className, "flex-shrink-0 text-blue-500")} />;
        case "GAU":
          return <GauIcon className={cn(className, "flex-shrink-0")} />; // Uses built-in gold color with black stroke
        case "GAUC":
          return <GaucIcon className={cn(className, "flex-shrink-0")} />; // Uses built-in red color with white stroke
        case "GAU-GAUC":
          return <GauGaucIcon className={cn(className, "flex-shrink-0")} />; // Uses red-to-gold gradient
        default:
          return null;
      }
    };

    // Helper function to get token colors
    const getTokenColors = (symbol: string) => {
      switch (symbol) {
        case "ERG":
          return {
            trigger: "bg-muted hover:bg-muted/80 border-border text-foreground",
            content: "border-border",
            item: "focus:bg-accent focus:text-accent-foreground",
          };
        case "GAU":
          return {
            trigger: "bg-muted hover:bg-muted/80 border-border text-foreground",
            content: "border-border",
            item: "focus:bg-accent focus:text-accent-foreground",
          };
        case "GAUC":
          return {
            trigger: "bg-muted hover:bg-muted/80 border-border text-foreground",
            content: "border-border",
            item: "focus:bg-accent focus:text-accent-foreground",
          };
        case "GAU-GAUC":
          return {
            trigger: "bg-muted hover:bg-muted/80 border-border text-foreground",
            content: "border-border",
            item: "focus:bg-accent focus:text-accent-foreground",
          };
        default:
          return {
            trigger: "bg-muted hover:bg-muted/80 border-border text-foreground",
            content: "border-border",
            item: "focus:bg-accent focus:text-accent-foreground",
          };
      }
    };

    const tokenColors = getTokenColors(currentToken.symbol);

    return (
      <motion.div
        className="w-full rounded-xl bg-gradient-to-r from-foreground/10 to-muted-foreground/5 p-4 dark:from-white/10 dark:to-white/5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={{
          scale: 1.01,
          backgroundColor: "rgba(255, 255, 255, 0.12)",
          transition: { duration: 0.2 },
        }}
      >
        <motion.div className="mb-2 flex justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.2 }}>
          <span className="text-sm text-muted-foreground">{isFromCard ? "From" : "To"}</span>
          <AnimatePresence mode="wait">
            {isFromCard && currentToken.symbol !== "GAU-GAUC" && (
              <motion.span
                key={`${currentToken.symbol}-${currentToken.balance}`}
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                Balance: {formatTokenAmount(currentToken.balance)} {currentToken.symbol}
              </motion.span>
            )}
            {fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG" && !isFromCard && (
              <motion.span
                key={`max-${maxErgOutput}`}
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                MAX to Fusion: {maxErgOutput} ERG
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.2 }}
        >
          <Select value={currentToken.symbol} onValueChange={isFromCard ? handleFromTokenChange : handleToTokenChange} disabled={isInputDisabled}>
            <SelectTrigger className={cn("w-full px-3 py-2 font-sans font-semibold sm:w-[200px]", tokenColors.trigger, isInputDisabled && "cursor-not-allowed opacity-50")}>
              <SelectValue className="font-sans" />
            </SelectTrigger>
            <SelectContent className={cn("border bg-background font-sans shadow-lg", tokenColors.content)}>
              {(isFromCard ? tokens : getValidToTokens(fromToken.symbol, tokens)).map((token) => {
                const itemColors = getTokenColors(token.symbol);
                return (
                  <SelectItem key={token.symbol} value={token.symbol} className={cn("cursor-pointer font-sans font-medium", itemColors.item)}>
                    <div className="flex items-center gap-2 font-sans">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">{getTokenIcon(token.symbol, "w-6 h-6")}</div>
                      <span className="font-sans">{token.symbol}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {shouldRenderInputOrDisplay ? (
            <div className="flex min-w-0 flex-1 items-center justify-center pl-8 sm:justify-end">
              <motion.div key={`${currentToken.symbol}-input`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="min-w-[80px] flex-1">
                <NumericFormat
                  value={currentAmount}
                  onValueChange={(values) => handleAmountChange(values, isFromCard)}
                  thousandSeparator={false}
                  decimalScale={effectiveDecimalScale}
                  allowedDecimalSeparators={["."]}
                  allowNegative={false}
                  placeholder="0"
                  isAllowed={(values) => {
                    const { floatValue } = values;

                    // allow empty/backspace
                    if (floatValue === undefined) return true;

                    // block NaN and negatives
                    if (isNaN(floatValue) || floatValue < 0) return false;

                    // Special-case: when converting GAU-GAUC -> ERG we must enforce the precise max output
                    // (allow small display rounding via isUserInputMaxValue).
                    if (!isFromCard && fromToken.symbol === "GAU-GAUC" && currentToken.symbol === "ERG") {
                      try {
                        const inputBN = new BigNumber(floatValue || 0);
                        const maxErgBN = new BigNumber(maxErgOutputPrecise || "0");

                        return inputBN.isLessThanOrEqualTo(maxErgBN) || isUserInputMaxValue(inputBN.toString(), maxErgOutputPrecise);
                      } catch (error) {
                        console.error("Precision compare error in isAllowed:", error);
                        return false;
                      }
                    }

                    // For all other cases, be permissive: allow any non-negative number.
                    // (isSwapDisabled will be the authoritative gate for disabling the Swap button.)
                    return true;
                  }}
                  className={cn(
                    "w-full min-w-[80px] text-left sm:text-right border-0 bg-transparent text-2xl sm:text-3xl font-bold focus-visible:ring-0 focus:outline-none",
                    isFromCard ? "text-gray-400" : "text-gray-400",
                    isInputDisabled && "cursor-not-allowed opacity-50"
                  )}
                  disabled={isInputDisabled}
                  onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                />
              </motion.div>
              {(isFromCard
                ? currentToken.symbol !== "GAU-GAUC" // Show MAX in FROM for non-GAU-GAUC
                : fromToken.symbol === "GAU-GAUC" && currentToken.symbol === "ERG") && // Show MAX in TO only for GAU-GAUC to ERG
                boxesReady &&
                !isCalculating && (
                  <button
                    onClick={() => handleMax(isFromCard)}
                    className="mt-2 text-sm font-semibold text-foreground transition-colors hover:text-foreground/80 sm:ml-2 sm:mt-0"
                    disabled={isInputDisabled}
                  >
                    MAX
                  </button>
                )}
            </div>
          ) : null}
        </motion.div>

        {currentToken.symbol === "GAU-GAUC" && renderGauGaucCard(isFromCard)}
      </motion.div>
    );
  };

  const renderGauGaucCard = (isFromCard?: boolean) => {
    console.log(isFromCard)
    return <motion.div
      className="space-y-3 flex-1 w-full py-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <motion.div
        className="grid grid-cols-1 gap-3 px-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        {/* GAU Box with yellow/gold background */}
        <div>
          <span className="text-xs text-muted-foreground block mb-1.5 px-1">
            Balance: {formatTokenAmount(tokens.find(t => t.symbol === "GAU")?.balance || '0')}
          </span>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.2 }}
            className="rounded-lg bg-gradient-to-r from-yellow-600/80 to-yellow-700/80 dark:from-yellow-600/70 dark:to-yellow-700/70 p-4 flex items-center justify-between gap-3"
            whileHover={{ scale: 1.01 }}
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <GauIcon className="w-8 h-8 flex-shrink-0" />
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={`gau-${gauAmount}`}
                className="flex-1 text-xl sm:text-2xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {formatTokenAmount(gauAmount)}
              </motion.span>
            </AnimatePresence>
            <motion.div
              className="px-3 py-1.5 rounded-md font-bold text-sm bg-yellow-800/60 dark:bg-yellow-900/60 text-white flex items-center gap-1.5"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.1 }}
            >
              GAU
            </motion.div>
          </motion.div>
        </div>

        {/* GAUC Box with red background */}
        <div>
          <span className="text-xs text-muted-foreground block mb-1.5 px-1">
            Balance: {formatTokenAmount(tokens.find(t => t.symbol === "GAUC")?.balance || '0')}
          </span>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.2 }}
            className="rounded-lg bg-gradient-to-r from-red-600/80 to-red-700/80 dark:from-red-600/70 dark:to-red-700/70 p-4 flex items-center justify-between gap-3"
            whileHover={{ scale: 1.01 }}
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <GaucIcon className="w-8 h-8 flex-shrink-0" />
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={`gauc-${gaucAmount}`}
                className="flex-1 text-xl sm:text-2xl font-bold text-white"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {formatTokenAmount(gaucAmount)}
              </motion.span>
            </AnimatePresence>
            <motion.div
              className="px-3 py-1.5 rounded-md font-bold text-sm bg-red-800/60 dark:bg-red-900/60 text-white flex items-center gap-1.5"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.1 }}
            >
              GAUC
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const currentAction = getActionType(fromToken.symbol, toToken.symbol);

  // const amount = parseFloat(fromAmount || "0");            // numeric amount user typed
  // const maxAmount = parseFloat(fromToken?.balance || "0"); // what's allowed

  const isSwapDisabled = () => {
    if (isLoading || !isConnected || !boxesReady || isCalculating || (isInitializing && !boxesReady) || hasPendingTransactions) return true;

    const fromVal = parseFloat(fromAmount);
    const toVal = parseFloat(toAmount);

    if (fromToken.symbol === "GAU-GAUC" && toToken.symbol === "ERG") {
      const ergOutput = toVal;
      const gauRequired = parseFloat(gauAmount);
      const gaucRequired = parseFloat(gaucAmount);
      const gauBalance = parseFloat(tokens.find((t) => t.symbol === "GAU")?.balance || "0");
      const gaucBalance = parseFloat(tokens.find((t) => t.symbol === "GAUC")?.balance || "0");
      if (isNaN(ergOutput) || ergOutput <= 0) return true;
      if (isNaN(gauRequired) || gauRequired <= 0) return true;
      if (isNaN(gaucRequired) || gaucRequired <= 0) return true;
      if (gauRequired > gauBalance || gaucRequired > gaucBalance) return true;

      // Use precise comparison but allow for display value tolerance
      try {
        const ergOutputBN = new BigNumber(toAmount || "0");
        const maxErgBN = new BigNumber(maxErgOutputPrecise || "0");

        // Disable if output exceeds max AND it's not close to max (accounting for display rounding)
        if (ergOutputBN.isGreaterThan(maxErgBN) && !isUserInputMaxValue(toAmount, maxErgOutputPrecise)) {
          return true;
        }
      } catch (error) {
        console.error("Error in precision comparison:", error);
        return true;
      }
      return false;
    }

    if (fromToken.symbol === "ERG" && toToken.symbol === "GAU-GAUC") {
      const ergInput = fromVal;
      const ergBalanceStr = fromToken.balance.replace(/,/g, '');
      const ergBalance = parseFloat(ergBalanceStr);
      if (isNaN(ergInput) || ergInput <= 0) return true;
      if (ergInput > ergBalance) return true;
      if (ergBalance - ergInput < 0.1) return true;
      
      return false;
    }
    if (fromToken.symbol === "GAUC" && toToken.symbol === "GAU") {
      const gaucInput = fromVal;
      const gaucBalance = parseFloat(tokens.find((t) => t.symbol === "GAUC")?.balance || "0");
      if (Number.isNaN(gaucInput) || gaucInput <= 0) return true;
      if (gaucInput > gaucBalance) return true; 
      return false;
    }
    if (fromToken.symbol === "GAU" && toToken.symbol === "GAUC") {
      const gauInput = fromVal;
      const gauBalance = parseFloat(tokens.find((t) => t.symbol === "GAU")?.balance || "0");
      if (Number.isNaN(gauInput) || gauInput <= 0) return true;
      if (gauInput > gauBalance) return true;
      return false;
    } 
    return true;
  }

  return (
    <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-start xl:justify-evenly">
      {/* Reactor Card - Centered */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="w-full xl:w-[580px]">
        <Card className="rounded-2xl">
          <CardHeader className="space-y-1.5 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <h2 className="text-4xl font-bold">Reactor</h2>
                <p className="text-2xl font-semibold text-primary dark:text-accent-foreground">{getTitle(currentAction)}</p>
                <p className="text-sm text-muted-foreground">{getDescription(currentAction)}</p>
                {initError && <p className="text-sm text-red-500">{initError}</p>}
                {hasPendingTransactions && <p className="animate-pulse text-sm text-blue-500">🔄 Transaction pending - waiting for wallet update...</p>}
              </div>
              {/* <Button
                variant="ghost"
                size="icon"
                className="rounded-lg bg-white/5"
              >
                <Settings2 className="h-5 w-5" />
              </Button> */}
            </div>
          </CardHeader>

          <CardContent className="space-y-1 p-6 pt-0">
            <AnimatePresence mode="wait">
              {(!boxesReady || isInitializing) && !initError ? (
                <motion.div key="loading-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-1">
                  {renderSkeletonCard(true)}

                  <div className="relative flex justify-center">
                    <div className="absolute -bottom-2 -top-2 z-[999] flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <div className="rounded-full border-border bg-card p-3 shadow-md">
                          <motion.svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground">
                            <path d="M4 5h8M8 1L4 5l4-4M12 11H4M8 15l4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {renderSkeletonCard(false)}
                </motion.div>
              ) : (
                <motion.div
                  key="actual-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="space-y-1"
                >
                  {renderTokenCard(true)}

                  <div className="relative flex justify-center">
                    <div className="pointer-events-none absolute -bottom-2 -top-2 z-[999] flex items-center justify-center">
                      <motion.div whileHover={{ scale: 1.1, rotate: 180 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.2 }} className="pointer-events-auto">
                        <Button
                          variant="outline"
                          size="icon"
                          className="relative rounded-full border-border bg-card shadow-md transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:shadow-lg"
                          onClick={handleSwapTokens}
                          disabled={!boxesReady || isCalculating || (isInitializing && !boxesReady)}
                        >
                          <motion.svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            initial={{ rotate: 0 }}
                            animate={{ rotate: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <path d="M4 5h8M8 1L4 5l4-4M12 11H4M8 15l4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        </Button>
                      </motion.div>
                    </div>
                  </div>

                  {renderTokenCard(false)}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {(!boxesReady || isInitializing) && !initError ? (
                <motion.div
                  key="loading-button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4"
                >
                  <div className="relative h-12 w-full overflow-hidden rounded-lg bg-gradient-to-r from-muted/60 via-muted/80 to-muted/60 bg-[length:200px_100%]">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "linear",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.span
                        className="text-sm text-muted-foreground"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        Connecting to Gluon Network...
                      </motion.span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="actual-button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  whileHover={{ scale: isSwapDisabled() ? 1 : 1.02 }}
                  whileTap={{ scale: isSwapDisabled() ? 1 : 0.98 }}
                >
                  <Button
                    className={cn("relative mt-4 h-12 w-full overflow-hidden bg-orange-500", !isSwapDisabled() ? "hover:bg-orange-600" : "cursor-not-allowed opacity-50")}
                    onClick={handleSwap}
                    disabled={isSwapDisabled()}
                  >
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={isLoading ? "loading" : isCalculating ? "calculating" : hasPendingTransactions ? "pending" : "swap"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isLoading ? "Processing..." : isCalculating ? "Calculating..." : hasPendingTransactions ? "Transaction Pending..." : "Swap"}
                      </motion.span>
                    </AnimatePresence>

                    {isLoading && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent dark:from-transparent dark:via-white/10 dark:to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          ease: "linear",
                        }}
                      />
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Receipt Card - Compact when on the right */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        whileHover={{ y: -2 }}
        className="w-full md:w-full lg:w-full xl:w-[260px]"
      >
        <Card className="rounded-2xl">
          <CardContent className="p-6 xl:p-4">
            <motion.div className="space-y-2 text-sm xl:space-y-1.5 xl:text-xs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.2 }}>
              <motion.div className="flex justify-between" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.2 }}>
                <span className="text-muted-foreground xl:text-xs">Input Amount</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`input-${receiptDetails.inputAmount}-${fromToken.symbol}`}
                    className="text-muted-foreground"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {fromToken.symbol !== "GAU-GAUC"
                      ? `${formatTokenAmount(formatValue(receiptDetails.inputAmount))} ${fromToken.symbol}`
                      : `${formatTokenAmount(gauAmount)} GAU - ${formatTokenAmount(gaucAmount)} GAUC`}
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              <Separator className="my-2 xl:my-1 xl:opacity-50" />

              {receiptDetails.fees.devFee ? (
                <motion.div className="flex justify-between" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.2 }}>
                  <span className="text-muted-foreground xl:text-xs">Dev Fee</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`dev-fee-${receiptDetails.fees.devFee}`}
                      className="text-muted-foreground"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {formatTokenAmount(formatValue(receiptDetails.fees.devFee))} ERG
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              ) : null}
              {receiptDetails.fees.oracleFee ? (
                <motion.div className="flex justify-between" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.2 }}>
                  <span className="text-muted-foreground xl:text-xs">Oracle Fee</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`oracle-fee-${receiptDetails.fees.oracleFee}`}
                      className="text-muted-foreground"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {formatTokenAmount(formatValue(receiptDetails.fees.oracleFee))} ERG
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              ) : null}
              {receiptDetails.fees.minerFee ? (
                <motion.div className="flex justify-between" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.2 }}>
                  <span className="text-muted-foreground xl:text-xs">Miner Fee</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`miner-fee-${receiptDetails.fees.minerFee}`}
                      className="text-muted-foreground"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {formatTokenAmount(formatValue(receiptDetails.fees.minerFee))} ERG
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
              ) : null}

              <Separator className="my-2 xl:my-1 xl:opacity-50" />

              <motion.div
                className="flex justify-between font-medium xl:text-xs"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65, duration: 0.2 }}
              >
                <span className="xl:font-semibold">Total Fees</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`total-fee-${receiptDetails.fees.totalFee}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {formatTokenAmount(formatValue(receiptDetails.fees.totalFee))} ERG
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              <Separator className="my-2 xl:my-1.5 xl:opacity-70" />

              <motion.div
                className="flex justify-between text-base font-medium xl:text-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.2 }}
              >
                <span className="xl:font-semibold">You Will Receive</span>
                <div className="text-right">
                  <AnimatePresence mode="wait">
                    {toToken.symbol === "ERG" && (
                      <motion.span
                        key={`output-erg-${receiptDetails.outputAmount.erg}`}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {formatTokenAmount(formatValue(receiptDetails.outputAmount.erg))} ERG
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {toToken.symbol === "GAU-GAUC" && (
                      <motion.div
                        key={`output-pair-${receiptDetails.outputAmount.gau}-${receiptDetails.outputAmount.gauc}`}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div>{formatTokenAmount(formatValue(receiptDetails.outputAmount.gau))} GAU</div>
                        <div>{formatTokenAmount(formatValue(receiptDetails.outputAmount.gauc))} GAUC</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {toToken.symbol === "GAU" && currentAction === "gauc-to-gau" && (
                      <motion.span
                        key={`output-gau-${receiptDetails.outputAmount.gau}`}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {formatTokenAmount(formatValue(receiptDetails.outputAmount.gau))} GAU
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    {toToken.symbol === "GAUC" && currentAction === "gau-to-gauc" && (
                      <motion.span
                        key={`output-gauc-${receiptDetails.outputAmount.gauc}`}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {formatTokenAmount(formatValue(receiptDetails.outputAmount.gauc))} GAUC
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
