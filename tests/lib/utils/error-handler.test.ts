import { describe, expect, test } from "bun:test";
import {
    ErrorType,
    handleTransactionError,
    handleCalculationError,
    handleInitializationError,
} from "@/lib/utils/error-handler";

describe("Error Classification", () => {
    test("should classify network errors", () => {
        const error = new Error("Network connection failed");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.NETWORK);
    });

    test("should classify insufficient balance errors", () => {
        const error = new Error("Insufficient balance to complete transaction");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.INSUFFICIENT_BALANCE);
    });

    test("should classify wallet connection errors", () => {
        const error = new Error("Wallet not connected");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.WALLET_CONNECTION);
    });

    test("should classify wallet signing errors", () => {
        const error = new Error("User rejected the transaction");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.WALLET_SIGNING);
    });

    test("should classify transaction creation errors", () => {
        const error = new Error("Failed to create transaction");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.TRANSACTION_CREATION);
    });

    test("should classify UTXO validation errors", () => {
        const error = new Error("Malformed transaction: every input should be in UTXO");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.UTXO_VALIDATION);
    });

    test("should classify oracle errors", () => {
        const error = new Error("Oracle price feed unavailable");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.ORACLE_ERROR);
    });

    test("should classify invalid amount errors", () => {
        const error = new Error("Amount must be greater than zero");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.INVALID_AMOUNT);
    });

    test("should classify SDK errors", () => {
        const error = new Error("Fusion will need more tokens");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.SDK_ERROR);
    });

    test("should default to UNKNOWN for unrecognized errors", () => {
        const error = new Error("Some random error");
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.UNKNOWN);
    });
});

describe("Wallet Error Code Handling", () => {
    test("should handle wallet error code 2 (user rejected)", () => {
        const error = { code: 2, info: "User rejected." };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.WALLET_SIGNING);
        expect(result.message).toBe("User rejected.");
    });

    test("should handle wallet error code 1 (connection error)", () => {
        const error = { code: 1, info: "Wallet connection failed" };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.WALLET_CONNECTION);
    });

    test("should handle wallet error code 3 (insufficient funds)", () => {
        const error = { code: 3, info: "Insufficient funds" };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.INSUFFICIENT_BALANCE);
    });

    test("should handle wallet error code 4 (transaction creation)", () => {
        const error = { code: 4, info: "Transaction creation failed" };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.TRANSACTION_CREATION);
    });

    test("should handle wallet error code 5 (network error)", () => {
        const error = { code: 5, info: "Network error" };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.NETWORK);
    });

    test("should handle unknown wallet error codes", () => {
        const error = { code: 999, info: "Unknown error" };
        const result = handleTransactionError(error, "test", false);
        expect(result.type).toBe(ErrorType.UNKNOWN);
    });
});

describe("handleTransactionError", () => {
    test("should handle Error objects", () => {
        const error = new Error("Test error message");
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("Test error message");
        expect(result.technicalMessage).toContain("Test error message");
    });

    test("should handle string errors", () => {
        const error = "String error message";
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("String error message");
        expect(result.technicalMessage).toBe("String error message");
    });

    test("should handle wallet error objects", () => {
        const error = { code: 2, info: "User cancelled" };
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("User cancelled");
        expect(result.technicalMessage).toContain("Code: 2");
    });

    test("should customize message for fission insufficient balance", () => {
        const error = new Error("Insufficient balance");
        const result = handleTransactionError(error, "fission", false);
        expect(result.userMessage).toContain("fission");
        expect(result.userMessage).toContain("ERG");
    });

    test("should customize message for fusion insufficient balance", () => {
        const error = new Error("Insufficient balance");
        const result = handleTransactionError(error, "fusion", false);
        expect(result.userMessage).toContain("fusion");
        expect(result.userMessage).toContain("GAU/GAUC");
    });

    test("should customize message for transmutation insufficient balance", () => {
        const error = new Error("Insufficient balance");
        const result = handleTransactionError(error, "transmutation", false);
        expect(result.userMessage).toContain("transmutation");
    });

    test("should include action type in error details", () => {
        const error = new Error("Test error");
        const result = handleTransactionError(error, "custom-action", false);
        expect(result.actionType).toBe("custom-action");
    });

    test("should return user-friendly messages", () => {
        const error = new Error("Network connection failed");
        const result = handleTransactionError(error, "test", false);
        expect(result.userMessage).toBe("Network connection error. Please check your internet connection and try again.");
    });
});

describe("handleCalculationError", () => {
    test("should handle calculation errors", () => {
        const error = new Error("Division by zero");
        const result = handleCalculationError(error, "fusion", false);
        expect(result.type).toBe(ErrorType.CALCULATION_ERROR);
        expect(result.actionType).toBe("fusion");
    });

    test("should provide calculation-specific user message", () => {
        const error = new Error("Invalid calculation");
        const result = handleCalculationError(error, "fission", false);
        expect(result.userMessage).toContain("calculate");
        expect(result.userMessage).toContain("fission");
    });

    test("should handle wallet error objects in calculations", () => {
        const error = { code: 2, info: "User rejected" };
        const result = handleCalculationError(error, "test", false);
        expect(result.message).toBe("User rejected");
    });

    test("should handle string errors in calculations", () => {
        const error = "Calculation failed";
        const result = handleCalculationError(error, "test", false);
        expect(result.message).toBe("Calculation failed");
    });
});

describe("handleInitializationError", () => {
    test("should handle initialization errors", () => {
        const error = new Error("Failed to initialize oracle");
        const result = handleInitializationError(error, "oracle", false);
        expect(result.actionType).toBe("oracle initialization");
    });

    test("should provide component-specific context", () => {
        const error = new Error("Init failed");
        const result = handleInitializationError(error, "wallet", false);
        expect(result.actionType).toContain("wallet");
    });

    test("should handle network errors during initialization", () => {
        const error = new Error("Network timeout during initialization");
        const result = handleInitializationError(error, "system", false);
        expect(result.type).toBe(ErrorType.NETWORK);
    });
});

describe("Error Message Handling", () => {
    test("should handle errors with message property", () => {
        const error = { message: "Custom error message" };
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("Custom error message");
    });

    test("should handle errors with info property", () => {
        const error = { info: "Error info message" };
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("Error info message");
    });

    test("should handle unknown error objects", () => {
        const error = { someProperty: "value" };
        const result = handleTransactionError(error, "test", false);
        expect(result.message).toBe("Wallet error occurred");
    });

    test("should handle null/undefined errors", () => {
        const result = handleTransactionError(null, "test", false);
        expect(result.message).toBe("An unknown error occurred");
    });
});
