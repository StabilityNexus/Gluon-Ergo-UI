/**
 * @file swapButtonState.test.ts
 * @description Unit tests for getSwapButtonState 12-level precedence hierarchy and collision scenarios.
 * @module test
 */

import { describe, it, expect } from "bun:test";
import { GluonError } from "@stability-nexus/gluon-ergo-sdk";
import { ACTION_TYPES } from "@/lib/constants/token";
import {
  getSwapButtonState,
  type SwapButtonStateInput,
} from "@/lib/functions/reactor/swapButtonState";
import type { SwapAvailability } from "@/lib/functions/reactor/availability";
import { createFakeQuote } from "./fakeClient";

const healthyAvailability: SwapAvailability = {
  fission: true,
  fusion: true,
  transmuteToPeg: true,
  transmuteFromPeg: true,
};

const loadingAvailability: SwapAvailability = {
  fission: false,
  fusion: false,
  transmuteToPeg: false,
  transmuteFromPeg: false,
  banner: {
    code: "LOADING",
    text: "Loading reactor data…",
  },
};

const unhealthyAvailability: SwapAvailability = {
  fission: false,
  fusion: false,
  transmuteToPeg: false,
  transmuteFromPeg: false,
  banner: {
    code: "REACTOR_UNHEALTHY_ABOVE",
    text: "The neutrons in circulation are worth more than 98 % of this reactor's reserve.",
  },
};

function createBaseValidInput(overrides: Partial<SwapButtonStateInput> = {}): SwapButtonStateInput {
  return {
    connected: true,
    walletReady: true,
    balancesReady: true,
    listenerReady: true,
    availability: healthyAvailability,
    action: ACTION_TYPES.FISSION,
    amountText: "1.5",
    quote: {
      status: "ready",
      result: {
        ok: true,
        quote: createFakeQuote(),
      },
    },
    limits: {
      exceeds: "none",
    },
    inProgress: false,
    hasPending: false,
    ...overrides,
  };
}

describe("swapButtonState 12-level precedence hierarchy", () => {
  it("Row 1: not connected -> 'Connect wallet (top bar)' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ connected: false }));
    expect(state).toEqual({
      disabled: true,
      label: "Connect wallet (top bar)",
    });
  });

  it("Row 1: connected but not walletReady -> 'Connect wallet (top bar)' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ connected: true, walletReady: false }));
    expect(state).toEqual({
      disabled: true,
      label: "Connect wallet (top bar)",
    });
  });

  it("Row 2: availability blocks action with LOADING banner -> 'Loading reactor data…' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ availability: loadingAvailability }));
    expect(state).toEqual({
      disabled: true,
      label: "Loading reactor data…",
    });
  });

  it("Row 2: availability blocks action with non-loading banner -> 'Trading paused' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ availability: unhealthyAvailability }));
    expect(state).toEqual({
      disabled: true,
      label: "Trading paused",
    });
  });

  it("Row 2: action is null -> 'Trading paused' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ action: null }));
    expect(state).toEqual({
      disabled: true,
      label: "Trading paused",
    });
  });

  it("Row 3: balancesReady is false -> 'Loading wallet…' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ balancesReady: false }));
    expect(state).toEqual({
      disabled: true,
      label: "Loading wallet…",
    });
  });

  it("Row 3: listenerReady is false -> 'Loading wallet…' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ listenerReady: false }));
    expect(state).toEqual({
      disabled: true,
      label: "Loading wallet…",
    });
  });

  it("Row 4: inProgress is true -> 'Transaction in progress…' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ inProgress: true }));
    expect(state).toEqual({
      disabled: true,
      label: "Transaction in progress…",
    });
  });

  it("Row 5: hasPending is true -> 'Transaction pending…' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ hasPending: true }));
    expect(state).toEqual({
      disabled: true,
      label: "Transaction pending…",
    });
  });

  it("Row 6: empty amount -> 'Enter an amount' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ amountText: "" }));
    expect(state).toEqual({
      disabled: true,
      label: "Enter an amount",
    });
  });

  it("Row 6: whitespace amount -> 'Enter an amount' (disabled)", () => {
    const state = getSwapButtonState(createBaseValidInput({ amountText: "   " }));
    expect(state).toEqual({
      disabled: true,
      label: "Enter an amount",
    });
  });

  it("Row 7: quote.status is pending -> 'Calculating…' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        quote: {
          status: "pending",
        },
      })
    );
    expect(state).toEqual({
      disabled: true,
      label: "Calculating…",
    });
  });

  it("Row 8: quote invalid-input -> 'Enter a valid amount' (disabled, with inlineError)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "invalid-input",
            message: "Amount must be greater than zero",
          },
        },
      })
    );
    expect(state).toEqual({
      disabled: true,
      label: "Enter a valid amount",
      inlineError: "Amount must be greater than zero",
    });
  });

  it("Row 9: quote GluonError WOULD_LEAVE_HEALTHY_RANGE -> 'Exceeds healthy limit' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        max: 50000000000n,
        decimals: 9,
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "Leave healthy range"),
          },
        },
      })
    );
    expect(state.disabled).toBe(true);
    expect(state.label).toBe("Exceeds healthy limit");
    expect(state.inlineError).toContain("50");
  });

  it("Row 9: quote GluonError AMOUNT_TOO_SMALL -> 'Amount too small' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("AMOUNT_TOO_SMALL", "Amount too small to produce tokens"),
          },
        },
      })
    );
    expect(state.disabled).toBe(true);
    expect(state.label).toBe("Amount too small");
    expect(state.inlineError).toBe("The amount is too small to produce any tokens.");
  });

  it("Row 9: quote GluonError other code -> 'Cannot swap' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("AMOUNT_TOO_LARGE", "Too large"),
          },
        },
      })
    );
    expect(state.disabled).toBe(true);
    expect(state.label).toBe("Cannot swap");
    expect(state.inlineError).toBe("The reactor cannot pay out or release that amount.");
  });

  it("Row 10: quote unexpected error -> 'Cannot swap' (disabled, unexpected inlineError)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "unexpected",
            error: new Error("Random RPC crash"),
          },
        },
      })
    );
    expect(state).toEqual({
      disabled: true,
      label: "Cannot swap",
      inlineError: "Unexpected error while calculating the quote",
    });
  });

  it("Row 11: limits.exceeds 'balance' -> 'Insufficient balance' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        limits: { exceeds: "balance" },
      })
    );
    expect(state).toEqual({
      disabled: true,
      label: "Insufficient balance",
    });
  });

  it("Row 11: limits.exceeds 'max' -> 'Exceeds maximum' (disabled)", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        limits: { exceeds: "max" },
      })
    );
    expect(state).toEqual({
      disabled: true,
      label: "Exceeds maximum",
    });
  });

  it("Row 12: all conditions met -> 'Swap' (enabled, no inlineError)", () => {
    const state = getSwapButtonState(createBaseValidInput());
    expect(state).toEqual({
      disabled: false,
      label: "Swap",
    });
  });
});

describe("swapButtonState precedence collisions", () => {
  it("Collision 1: pending + empty amount -> Rule 6 wins: 'Enter an amount'", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        amountText: "",
        quote: { status: "pending" },
      })
    );
    expect(state.label).toBe("Enter an amount");
    expect(state.disabled).toBe(true);
  });

  it("Collision 2: in-progress + not connected -> Rule 1 wins: 'Connect wallet (top bar)'", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        connected: false,
        inProgress: true,
      })
    );
    expect(state.label).toBe("Connect wallet (top bar)");
    expect(state.disabled).toBe(true);
  });

  it("Collision 3: loading (!balancesReady) + quote error -> Rule 3 wins: 'Loading wallet…'", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        balancesReady: false,
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("AMOUNT_TOO_SMALL", "Too small"),
          },
        },
      })
    );
    expect(state.label).toBe("Loading wallet…");
    expect(state.disabled).toBe(true);
  });

  it("Collision 4: availability block + valid quote -> Rule 2 wins: 'Trading paused'", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        availability: unhealthyAvailability,
        quote: {
          status: "ready",
          result: {
            ok: true,
            quote: createFakeQuote(),
          },
        },
      })
    );
    expect(state.label).toBe("Trading paused");
    expect(state.disabled).toBe(true);
  });

  it("Collision 5: hasPending + invalid amount -> Rule 5 wins: 'Transaction pending…'", () => {
    const state = getSwapButtonState(
      createBaseValidInput({
        hasPending: true,
        amountText: "invalid",
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "invalid-input",
            message: "Invalid numeric input",
          },
        },
      })
    );
    expect(state.label).toBe("Transaction pending…");
    expect(state.disabled).toBe(true);
  });

  it("the WOULD_LEAVE message contains the formatted maximum with maxText or max", () => {
    const stateWithBigint = getSwapButtonState(
      createBaseValidInput({
        max: 50000000000n,
        decimals: 9,
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "Leave"),
          },
        },
      })
    );
    expect(stateWithBigint.inlineError).toBe(
      "This amount would push the reactor out of its healthy range. The maximum is 50."
    );

    const stateWithText = getSwapButtonState(
      createBaseValidInput({
        maxText: "42.5",
        quote: {
          status: "ready",
          result: {
            ok: false,
            kind: "gluon",
            error: new GluonError("WOULD_LEAVE_HEALTHY_RANGE", "Leave"),
          },
        },
      })
    );
    expect(stateWithText.inlineError).toBe(
      "This amount would push the reactor out of its healthy range. The maximum is 42.5."
    );
  });
});

