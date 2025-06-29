import { toast } from "sonner"

/**
 * Example of wallet error object handling:
 * Input: {code: 2, info: 'User rejected.'}
 * Output: ErrorType.WALLET_SIGNING with message "Transaction was cancelled by user or signing failed. Please try again."
 */

// Error types enum for better categorization
export enum ErrorType {
    NETWORK = 'NETWORK',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    TRANSACTION_CREATION = 'TRANSACTION_CREATION',
    WALLET_CONNECTION = 'WALLET_CONNECTION',
    WALLET_SIGNING = 'WALLET_SIGNING',
    TRANSACTION_SUBMISSION = 'TRANSACTION_SUBMISSION',
    BOX_INITIALIZATION = 'BOX_INITIALIZATION',
    ORACLE_ERROR = 'ORACLE_ERROR',
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    SDK_ERROR = 'SDK_ERROR',
    CALCULATION_ERROR = 'CALCULATION_ERROR',
    UNKNOWN = 'UNKNOWN'
}

// Error details interface
export interface ErrorDetails {
    type: ErrorType
    message: string
    technicalMessage?: string
    userMessage: string
    actionType?: string
}

// Error patterns for classification
const ERROR_PATTERNS = {
    // Network related errors
    network: [
        /network/i,
        /connection/i,
        /timeout/i,
        /fetch.*failed/i,
        /failed to get network height/i,
        /node.*not.*responding/i,
        /rpc.*error/i
    ],

    // Balance related errors
    insufficientBalance: [
        /insufficient/i,
        /not enough/i,
        /balance.*too.*low/i,
        /cannot.*afford/i,
        /exceeds.*balance/i,
        /maximum possible output/i,
        /cannot get.*erg/i
    ],

    // Transaction creation errors
    transactionCreation: [
        /failed to create.*transaction/i,
        /transaction.*creation.*failed/i,
        /invalid.*transaction/i,
        /cannot.*build.*transaction/i,
        /unsigned.*transaction.*failed/i
    ],

    // Wallet errors
    walletConnection: [
        /wallet.*not.*connected/i,
        /no.*wallet/i,
        /wallet.*unavailable/i,
        /ergo.*wallet.*not.*found/i
    ],

    // Wallet signing errors
    walletSigning: [
        /sign.*failed/i,
        /signing.*error/i,
        /user.*rejected/i,
        /user rejected/i,
        /signature.*failed/i,
        /wallet.*sign/i,
        /cancelled.*by.*user/i,
        /transaction.*cancelled/i,
        /user.*cancelled/i,
        /denied.*by.*user/i
    ],

    // Transaction submission errors
    transactionSubmission: [
        /submit.*failed/i,
        /submission.*error/i,
        /broadcast.*failed/i,
        /mempool.*rejected/i,
        /transaction.*rejected/i
    ],

    // Box initialization errors
    boxInitialization: [
        /failed to.*get.*box/i,
        /box.*not.*found/i,
        /oracle.*box.*error/i,
        /gluon.*box.*error/i,
        /failed to initialize/i
    ],

    // Oracle related errors
    oracle: [
        /oracle/i,
        /price.*feed/i,
        /oracle.*buyback/i,
        /height.*error/i
    ],

    // Amount validation errors
    invalidAmount: [
        /amount.*invalid/i,
        /invalid.*value/i,
        /must be greater than zero/i,
        /amount.*too.*small/i,
        /amount.*too.*large/i
    ],

    // SDK specific errors
    sdk: [
        /fusion.*will.*need/i,
        /fission.*will.*get/i,
        /transmute.*will.*get/i,
        /gluon.*sdk/i,
        /calculation.*failed/i
    ]
}

// User-friendly error messages
const USER_MESSAGES = {
    [ErrorType.NETWORK]: "Network connection error. Please check your internet connection and try again.",
    [ErrorType.INSUFFICIENT_BALANCE]: "Insufficient balance for this transaction.",
    [ErrorType.TRANSACTION_CREATION]: "Failed to create transaction. Please try again.",
    [ErrorType.WALLET_CONNECTION]: "Wallet not connected. Please connect your wallet first.",
    [ErrorType.WALLET_SIGNING]: "Transaction was cancelled by user or signing failed. Please try again.",
    [ErrorType.TRANSACTION_SUBMISSION]: "Failed to submit transaction to the network. Please try again.",
    [ErrorType.BOX_INITIALIZATION]: "Failed to initialize blockchain data. Please refresh and try again.",
    [ErrorType.ORACLE_ERROR]: "Oracle data unavailable. Please try again in a moment.",
    [ErrorType.INVALID_AMOUNT]: "Invalid amount entered. Please check your input.",
    [ErrorType.SDK_ERROR]: "Calculation error. Please try again with different values.",
    [ErrorType.CALCULATION_ERROR]: "Failed to calculate transaction amounts. Please try again.",
    [ErrorType.UNKNOWN]: "An unexpected error occurred. Please try again."
}

/**
 * Handle wallet-specific error codes
 */
function classifyWalletErrorCode(code: number): ErrorType {
    switch (code) {
        case 2: // User rejected
            return ErrorType.WALLET_SIGNING;
        case 1: // Wallet connection error
            return ErrorType.WALLET_CONNECTION;
        case 3: // Insufficient funds
            return ErrorType.INSUFFICIENT_BALANCE;
        case 4: // Transaction creation error
            return ErrorType.TRANSACTION_CREATION;
        case 5: // Network error
            return ErrorType.NETWORK;
        default:
            return ErrorType.UNKNOWN;
    }
}

/**
 * Classify error based on error message patterns or wallet error codes
 */
function classifyError(error: Error | string | any): ErrorType {
    // Handle wallet error objects with codes
    if (error && typeof error === 'object' && !Array.isArray(error) && !(error instanceof Error)) {
        if (typeof error.code === 'number') {
            return classifyWalletErrorCode(error.code);
        }
    }

    const errorMessage = typeof error === 'string' ? error :
        (error instanceof Error ? error.message :
            (error?.info || error?.message || String(error)));

    for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(errorMessage))) {
            switch (type) {
                case 'network': return ErrorType.NETWORK;
                case 'insufficientBalance': return ErrorType.INSUFFICIENT_BALANCE;
                case 'transactionCreation': return ErrorType.TRANSACTION_CREATION;
                case 'walletConnection': return ErrorType.WALLET_CONNECTION;
                case 'walletSigning': return ErrorType.WALLET_SIGNING;
                case 'transactionSubmission': return ErrorType.TRANSACTION_SUBMISSION;
                case 'boxInitialization': return ErrorType.BOX_INITIALIZATION;
                case 'oracle': return ErrorType.ORACLE_ERROR;
                case 'invalidAmount': return ErrorType.INVALID_AMOUNT;
                case 'sdk': return ErrorType.SDK_ERROR;
                default: return ErrorType.UNKNOWN;
            }
        }
    }

    return ErrorType.UNKNOWN;
}

/**
 * Process and handle errors with appropriate user feedback
 */
export function handleTransactionError(
    error: Error | string | unknown,
    actionType: string = 'transaction',
    showToast: boolean = true
): ErrorDetails {
    console.error(`${actionType} error:`, error);

    let errorMessage: string;
    let technicalMessage: string;

    // Handle wallet-specific error objects (e.g., {code: 2, info: 'User rejected.'})
    if (error && typeof error === 'object' && !Array.isArray(error) && !(error instanceof Error)) {
        const walletError = error as any;
        if (walletError.info) {
            errorMessage = walletError.info;
            technicalMessage = `Wallet error - Code: ${walletError.code}, Info: ${walletError.info}`;
        } else if (walletError.message) {
            errorMessage = walletError.message;
            technicalMessage = `Error object: ${JSON.stringify(walletError)}`;
        } else {
            errorMessage = 'Wallet error occurred';
            technicalMessage = `Unknown wallet error: ${JSON.stringify(walletError)}`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
        technicalMessage = error.stack || error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
        technicalMessage = error;
    } else {
        errorMessage = 'An unknown error occurred';
        technicalMessage = String(error);
    }

    const errorType = classifyError(error);
    let userMessage = USER_MESSAGES[errorType];

    // Customize user message based on action type
    if (errorType === ErrorType.INSUFFICIENT_BALANCE) {
        switch (actionType.toLowerCase()) {
            case 'fission':
                userMessage = "Insufficient ERG balance for fission. Please ensure you have enough ERG plus fees.";
                break;
            case 'fusion':
                userMessage = "Insufficient GAU/GAUC balance for fusion. Please check your token balances.";
                break;
            case 'transmutation':
                userMessage = "Insufficient token balance for transmutation.";
                break;
        }
    }

    const errorDetails: ErrorDetails = {
        type: errorType,
        message: errorMessage,
        technicalMessage,
        userMessage,
        actionType
    };

    // Show toast notification
    if (showToast) {
        toast.error(userMessage, {
            description: errorType === ErrorType.UNKNOWN ? errorMessage : undefined,
            duration: 5000,
        });
    }

    return errorDetails;
}

/**
 * Handle successful transactions
 */
export function handleTransactionSuccess(
    txHash: string,
    actionType: string,
    showToast: boolean = true
): void {
    const successMessage = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} transaction submitted successfully!`;

    console.log(`${actionType} success:`, { txHash });

    if (showToast) {
        toast.success(successMessage, {
            description: `Transaction ID: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
            duration: 10000,
        });
    }
}

/**
 * Handle calculation errors specifically
 */
export function handleCalculationError(
    error: Error | string | unknown,
    calculationType: string = 'calculation',
    showToast: boolean = false // Usually don't show toast for calculation errors as they're handled in UI
): ErrorDetails {
    console.error(`${calculationType} calculation error:`, error);

    let errorMessage: string;

    // Handle wallet-specific error objects
    if (error && typeof error === 'object' && !Array.isArray(error) && !(error instanceof Error)) {
        const walletError = error as any;
        if (walletError.info) {
            errorMessage = walletError.info;
        } else if (walletError.message) {
            errorMessage = walletError.message;
        } else {
            errorMessage = 'Wallet error occurred';
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        errorMessage = 'Calculation failed';
    }

    const errorType = classifyError(error);

    const errorDetails: ErrorDetails = {
        type: errorType === ErrorType.UNKNOWN ? ErrorType.CALCULATION_ERROR : errorType,
        message: errorMessage,
        userMessage: `Failed to calculate ${calculationType} amounts. Please try again.`,
        actionType: calculationType
    };

    if (showToast) {
        toast.error(errorDetails.userMessage, {
            duration: 3000,
        });
    }

    return errorDetails;
}

/**
 * Handle network/initialization errors
 */
export function handleInitializationError(
    error: Error | string | unknown,
    component: string = 'system',
    showToast: boolean = true
): ErrorDetails {
    console.error(`${component} initialization error:`, error);

    const errorDetails = handleTransactionError(error, `${component} initialization`, false);

    if (showToast) {
        toast.error(`Failed to initialize ${component}`, {
            description: errorDetails.userMessage || "Please refresh the page and try again.",
            duration: 7000,
        });
    }

    return errorDetails;
}
