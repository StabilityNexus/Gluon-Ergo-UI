import { describe, it, expect } from "bun:test";
import { ErrorType, handleCalculationError, handleInitializationError } from "./error-handler";

describe("handleCalculationError", () => {
  it("returns CALCULATION_ERROR for unknown errors", () => {
    const result = handleCalculationError("something went wrong", "test");
    expect(result.type).toBe(ErrorType.CALCULATION_ERROR);
    expect(result.userMessage).toContain("test");
  });

  it("classifies wallet rejection errors", () => {
    const result = handleCalculationError({ code: 2, info: "User rejected." });
    expect(result.type).toBe(ErrorType.WALLET_SIGNING);
  });

  it("extracts message from Error object", () => {
    const result = handleCalculationError(new Error("test error"));
    expect(result.message).toBe("test error");
  });

  it("extracts info from wallet error objects", () => {
    const result = handleCalculationError({ code: 1, info: "Wallet not connected" });
    expect(result.message).toBe("Wallet not connected");
  });
});

describe("handleInitializationError", () => {
  it("returns error details with component name", () => {
    const result = handleInitializationError("network error", "NodeService", false);
    expect(result.actionType).toBe("NodeService initialization");
    expect(result.type).toBe(ErrorType.NETWORK);
  });
});
