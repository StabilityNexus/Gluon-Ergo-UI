/**
 * @file error-handler.test.ts
 * @description Unit tests for GluonError mapping, formatted WOULD_LEAVE_HEALTHY_RANGE, and wallet cancellation detection.
 * @module test
 */
import { describe, expect, it } from "bun:test";
import { GluonError, type GluonErrorCode } from "@stability-nexus/gluon-ergo-sdk";
import {
  getGluonErrorMessage,
  isWalletCancellation,
  GLUON_ERROR_MESSAGES,
} from "@/lib/utils/error-handler";

describe("error-handler.ts", () => {
  describe("getGluonErrorMessage", () => {
    it("maps all standard GluonError codes correctly", () => {
      for (const [code, message] of Object.entries(GLUON_ERROR_MESSAGES)) {
        if (code === "WOULD_LEAVE_HEALTHY_RANGE") continue;
        const err = new GluonError(code as GluonErrorCode, "default sdk error text");
        expect(getGluonErrorMessage(err)).toBe(message);
      }
    });

    it("formats WOULD_LEAVE_HEALTHY_RANGE with default message when max is omitted", () => {
      const err = new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "too much");
      const msg = getGluonErrorMessage(err);
      expect(msg).toBe("This amount would push the reactor out of its healthy range.");
    });

    it("formats WOULD_LEAVE_HEALTHY_RANGE with formatted maximum using formatUnits", () => {
      const err = new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "too much");

      // 15 ERG with 9 decimals = "15"
      const msg1 = getGluonErrorMessage(err, { max: 15000000000n, decimals: 9 });
      expect(msg1).toBe("This amount would push the reactor out of its healthy range. The maximum is 15.");

      // 15.5 ERG with 9 decimals = "15.5"
      const msg2 = getGluonErrorMessage(err, { max: 15500000000n, decimals: 9 });
      expect(msg2).toBe("This amount would push the reactor out of its healthy range. The maximum is 15.5.");

      // 2.5 with 3 decimals = "2.5"
      const msg3 = getGluonErrorMessage(err, { max: 2500n, decimals: 3 });
      expect(msg3).toBe("This amount would push the reactor out of its healthy range. The maximum is 2.5.");
    });

    it("returns null for non-GluonError instances", () => {
      expect(getGluonErrorMessage(new Error("regular error"))).toBeNull();
      expect(getGluonErrorMessage("error string")).toBeNull();
      expect(getGluonErrorMessage(null)).toBeNull();
    });
  });

  describe("isWalletCancellation", () => {
    it("detects code 2 rejection", () => {
      expect(isWalletCancellation({ code: 2, info: "User rejected" })).toBe(true);
    });

    it("detects cancellation strings in error message or info", () => {
      expect(isWalletCancellation(new Error("User rejected the transaction"))).toBe(true);
      expect(isWalletCancellation(new Error("Cancelled by user"))).toBe(true);
      expect(isWalletCancellation({ message: "User declined request" })).toBe(true);
      expect(isWalletCancellation("user rejected")).toBe(true);
    });

    it("returns false for ordinary runtime errors", () => {
      expect(isWalletCancellation(new Error("Network timeout"))).toBe(false);
      expect(isWalletCancellation({ code: 500, message: "Node error" })).toBe(false);
      expect(isWalletCancellation(undefined)).toBe(false);
    });
  });
});
