/**
 * @file availability.ts
 * @description Computes swap action availability and warning banners per protocol state.
 * @module lib/functions/reactor
 *
 * Priority Order for State/Error Collisions:
 * 1. NODE_ERROR: Network/node unreachable blocks all operations immediately.
 * 2. BOX_AMBIGUOUS: Protocol boxes in transient update state block all operations.
 * 3. ORACLE_STALE: Stale oracle feed (oracleAge >= 35) blocks contract execution.
 * 4. Other Refresh Errors (other GluonErrors or generic network/runtime exceptions).
 * 5. Status loading / Missing snapshot: Disables actions with "Loading reactor data…".
 * 6. Unhealthy (q > 98% or q < 50%): Reactor out-of-range disables all swaps until peg adjustment.
 * 7. BUYBACK_UNAVAILABLE: Oracle buyback missing disables only transmutations; fission/fusion remain available.
 * 8. Healthy: All swaps available.
 */
import { GluonError, type ProtocolSnapshot } from "@stability-nexus/gluon-ergo-sdk";
import { getGluonErrorMessage } from "@/lib/utils/error-handler";

export interface SwapAvailabilityParams {
  snapshot?: ProtocolSnapshot;
  status: "loading" | "ready" | "error";
  error?: unknown;
}

export interface SwapBanner {
  code: string;
  text: string;
}

export interface SwapAvailability {
  fission: boolean;
  fusion: boolean;
  transmuteToPeg: boolean;
  transmuteFromPeg: boolean;
  banner?: SwapBanner;
}

export function getSwapAvailability({ snapshot, status, error }: SwapAvailabilityParams): SwapAvailability {
  // If refresh failed with an error, every action is disabled (even if last good snapshot exists)
  if (status === "error" || error) {
    // 1. NODE_ERROR: GluonError code NODE_ERROR, or raw network TypeError/AbortError escaping the SDK
    const isNodeError =
      (error instanceof GluonError && error.code === "NODE_ERROR") ||
      (error instanceof TypeError && /failed to fetch/i.test(error.message)) ||
      (error instanceof Error && (error.name === "AbortError" || /failed to fetch/i.test(error.message)));

    if (isNodeError) {
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: "NODE_ERROR",
          text: "Reconnecting to the node.",
        },
      };
    }

    // 2. BOX_AMBIGUOUS
    if (error instanceof GluonError && error.code === "BOX_AMBIGUOUS") {
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: "BOX_AMBIGUOUS",
          text: "The reactor or the oracle is being updated; retrying.",
        },
      };
    }

    // 3. ORACLE_STALE
    if (error instanceof GluonError && error.code === "ORACLE_STALE") {
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: "ORACLE_STALE",
          text: "Waiting for the next oracle update.",
        },
      };
    }

    // 4. Other GluonError codes
    if (error instanceof GluonError) {
      const text = getGluonErrorMessage(error) || error.message;
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: error.code,
          text,
        },
      };
    }

    // 5. Generic runtime Error
    return {
      fission: false,
      fusion: false,
      transmuteToPeg: false,
      transmuteFromPeg: false,
      banner: {
        code: "REFRESH_ERROR",
        text: "Could not load the reactor state. Retrying.",
      },
    };
  }

  // If loading or snapshot is missing, disable all actions
  if (status === "loading" || !snapshot) {
    return {
      fission: false,
      fusion: false,
      transmuteToPeg: false,
      transmuteFromPeg: false,
      banner: {
        code: "LOADING",
        text: "Loading reactor data…",
      },
    };
  }

  // 6. Oracle Stale from snapshot age (oracleAge >= 35)
  if (snapshot.oracleAge >= 35) {
    return {
      fission: false,
      fusion: false,
      transmuteToPeg: false,
      transmuteFromPeg: false,
      banner: {
        code: "ORACLE_STALE",
        text: "Waiting for the next oracle update.",
      },
    };
  }

  // 7. Unhealthy (q above 98% or q below 50%)
  if (!snapshot.healthy) {
    const direction = snapshot.adjustPeg?.direction ?? (snapshot.q > 980000000n ? "down" : "up");
    const steps = snapshot.adjustPeg?.steps ?? 1;

    if (direction === "down") {
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: "REACTOR_UNHEALTHY_ABOVE",
          text: `The neutrons in circulation are worth more than 98 % of this reactor's reserve. Trading resumes after the peg factor is lowered, 1 % per step (${steps} steps at the current price). Anyone can do this.`,
        },
      };
    }

    if (direction === "up") {
      return {
        fission: false,
        fusion: false,
        transmuteToPeg: false,
        transmuteFromPeg: false,
        banner: {
          code: "REACTOR_UNHEALTHY_BELOW",
          text: `The neutrons in circulation are worth less than 50 % of this reactor's reserve. Trading resumes after the peg factor is raised, 1 % per step (${steps} steps at the current price). Anyone can do this.`,
        },
      };
    }
  }

  // 8. BUYBACK_UNAVAILABLE (Transmutations disabled; fission and fusion work)
  if (!snapshot.betaDecaysAvailable) {
    return {
      fission: true,
      fusion: true,
      transmuteToPeg: false,
      transmuteFromPeg: false,
      banner: {
        code: "BUYBACK_UNAVAILABLE",
        text: "The oracle's buyback box is unavailable.",
      },
    };
  }

  // 9. Healthy / Default
  return {
    fission: true,
    fusion: true,
    transmuteToPeg: true,
    transmuteFromPeg: true,
    banner: undefined,
  };
}
