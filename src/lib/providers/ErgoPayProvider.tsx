"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ErgoPayBalances {
  erg: string;
  gau: string;
  gauc: string;
}

interface ErgoPayContextValue {
  address: string | null;
  setAddress: (address: string) => void;
  clearAddress: () => void;
  balances: ErgoPayBalances;
  setBalances: (balances: ErgoPayBalances) => void;
}

const STORAGE_KEY = "ergoPayAddress";
const BALANCE_STORAGE_KEY = "ergoPayBalances";
const DEFAULT_BALANCES: ErgoPayBalances = { erg: "0", gau: "0", gauc: "0" };

const ErgoPayContext = createContext<ErgoPayContextValue | undefined>(undefined);

export function ErgoPayProvider({ children }: { children: ReactNode }) {
  const [address, setAddressState] = useState<string | null>(null);
  const [balances, setBalancesState] = useState<ErgoPayBalances>(DEFAULT_BALANCES);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedAddress = window.localStorage.getItem(STORAGE_KEY);
    if (savedAddress) {
      setAddressState(savedAddress);
    }

    const savedBalances = window.localStorage.getItem(BALANCE_STORAGE_KEY);
    if (savedBalances) {
      try {
        const parsed = JSON.parse(savedBalances);
        setBalancesState({
          erg: parsed.erg ?? DEFAULT_BALANCES.erg,
          gau: parsed.gau ?? DEFAULT_BALANCES.gau,
          gauc: parsed.gauc ?? DEFAULT_BALANCES.gauc,
        });
      } catch (error) {
        console.error("Failed to parse ErgoPay balances from storage:", error);
      }
    }
  }, []);

  const setAddress = useCallback((newAddress: string) => {
    setAddressState(newAddress);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, newAddress);
    }
  }, []);

  const setBalances = useCallback((newBalances: ErgoPayBalances) => {
    setBalancesState(newBalances);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(newBalances));
    }
  }, []);

  const clearAddress = useCallback(() => {
    setAddressState(null);
    setBalancesState(DEFAULT_BALANCES);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(BALANCE_STORAGE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      address,
      setAddress,
      clearAddress,
      balances,
      setBalances,
    }),
    [address, setAddress, clearAddress, balances, setBalances]
  );

  return <ErgoPayContext.Provider value={value}>{children}</ErgoPayContext.Provider>;
}

export function useErgoPay() {
  const context = useContext(ErgoPayContext);
  if (!context) {
    throw new Error("useErgoPay must be used within an ErgoPayProvider");
  }
  return context;
}
