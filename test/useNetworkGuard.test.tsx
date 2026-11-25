/**
 * @file useNetworkGuard.test.tsx
 * @description Integration tests for useNetworkGuard with real ErgoProvider, fake wallet, timers, and SSR probe.
 * @module test
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ErgoProvider, useErgo } from "@/lib/providers/ErgoProvider";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import {
  setupDisconnectedWalletConnector,
  setupFakeWallet,
  teardownFakeWallet,
} from "./helpers/fakeWallet";

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  (globalThis as { localStorage?: Storage }).localStorage = window.localStorage;
}

function WalletConnectButton() {
  const { connect, disconnect } = useErgo();
  return (
    <div>
      <button
        type="button"
        data-testid="connect-button"
        onClick={() => {
          void connect("nautilus");
        }}
      >
        Connect Nautilus
      </button>
      <button
        type="button"
        data-testid="disconnect-button"
        onClick={() => {
          disconnect();
        }}
      >
        Disconnect
      </button>
    </div>
  );
}

function NetworkGuardProbe({ recheckMs }: { recheckMs?: number }) {
  const result = useNetworkGuard(recheckMs !== undefined ? { recheckMs } : undefined);
  return (
    <div>
      <span data-testid="status">{result.status}</span>
      <span data-testid="blocked">{String(result.blocked)}</span>
      <span data-testid="address">{result.address ?? ""}</span>
    </div>
  );
}

describe("useNetworkGuard Hook Tests", () => {
  const origConnector = window.ergoConnector;

  beforeEach(() => {
    setupDisconnectedWalletConnector();
  });

  afterEach(() => {
    cleanup();
    teardownFakeWallet(origConnector);
  });

  it("returns unknown and not blocked when disconnected", async () => {
    await act(async () => {
      render(
        <ErgoProvider>
          <WalletConnectButton />
          <NetworkGuardProbe />
        </ErgoProvider>
      );
    });

    expect(screen.getByTestId("status").textContent).toBe("unknown");
    expect(screen.getByTestId("blocked").textContent).toBe("false");
    expect(screen.getByTestId("address").textContent).toBe("");
  });

  it("returns mainnet and not blocked when connected with a '9...' address", async () => {
    const mainnetAddr = "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";
    setupFakeWallet({ getChangeAddress: async () => mainnetAddr });

    await act(async () => {
      render(
        <ErgoProvider>
          <WalletConnectButton />
          <NetworkGuardProbe recheckMs={60000} />
        </ErgoProvider>
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("mainnet");
    expect(screen.getByTestId("blocked").textContent).toBe("false");
    expect(screen.getByTestId("address").textContent).toBe(mainnetAddr);
  });

  it("returns wrong-network and blocked when connected with a '3...' testnet address", async () => {
    const testnetAddr = "3WvsT2Gm4EpsM9Pg18PdY6XyhNNMqXDsvJTbbf6ihLvAmSb7u5RN";
    setupFakeWallet({ getChangeAddress: async () => testnetAddr });

    await act(async () => {
      render(
        <ErgoProvider>
          <WalletConnectButton />
          <NetworkGuardProbe recheckMs={60000} />
        </ErgoProvider>
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("wrong-network");
    expect(screen.getByTestId("blocked").textContent).toBe("true");
    expect(screen.getByTestId("address").textContent).toBe(testnetAddr);
  });

  it("returns unknown and not blocked when get_change_address rejects", async () => {
    setupFakeWallet({
      getChangeAddress: async () => {
        throw new Error("Wallet locked");
      },
    });

    await act(async () => {
      render(
        <ErgoProvider>
          <WalletConnectButton />
          <NetworkGuardProbe recheckMs={60000} />
        </ErgoProvider>
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("unknown");
    expect(screen.getByTestId("blocked").textContent).toBe("false");
    expect(screen.getByTestId("address").textContent).toBe("");
  });

  it("re-checks after recheckMs and flips status when the wallet address switches", async () => {
    let activeAddress = "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";
    setupFakeWallet({
      getChangeAddress: async () => activeAddress,
    });

    let unmount!: () => void;
    await act(async () => {
      const rendered = render(
        <ErgoProvider>
          <WalletConnectButton />
          <NetworkGuardProbe recheckMs={15} />
        </ErgoProvider>
      );
      unmount = rendered.unmount;
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("connect-button"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("mainnet");
    expect(screen.getByTestId("blocked").textContent).toBe("false");

    activeAddress = "3WvsT2Gm4EpsM9Pg18PdY6XyhNNMqXDsvJTbbf6ihLvAmSb7u5RN";

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status").textContent).toBe("wrong-network");
    expect(screen.getByTestId("blocked").textContent).toBe("true");
    expect(screen.getByTestId("address").textContent).toBe(activeAddress);

    await act(async () => {
      unmount();
    });
  });

  it("re-checks when document visibilityState becomes visible and ignores stale runs", async () => {
    let resolveFirst!: (addr: string) => void;
    let callCount = 0;
    const mainnetAddr = "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";
    const testnetAddr = "3WvsT2Gm4EpsM9Pg18PdY6XyhNNMqXDsvJTbbf6ihLvAmSb7u5RN";

    setupFakeWallet({
      getChangeAddress: () => {
        callCount += 1;
        if (callCount === 1) {
          return new Promise<string>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve(mainnetAddr);
      },
    });

    const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState"
    );

    try {
      await act(async () => {
        render(
          <ErgoProvider>
            <WalletConnectButton />
            <NetworkGuardProbe recheckMs={60000} />
          </ErgoProvider>
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("connect-button"));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(callCount).toBe(1);
      expect(screen.getByTestId("status").textContent).toBe("unknown");

      // Trigger visibilitychange -> visible, starting run #2 while run #1 is still pending
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });

      expect(callCount).toBe(2);
      expect(screen.getByTestId("status").textContent).toBe("mainnet");

      // Now resolve stale run #1 with testnet address; it must be ignored
      await act(async () => {
        resolveFirst(testnetAddr);
        await Promise.resolve();
      });

      expect(screen.getByTestId("status").textContent).toBe("mainnet");
      expect(screen.getByTestId("blocked").textContent).toBe("false");
    } finally {
      if (originalVisibilityDescriptor) {
        Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
      } else {
        delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
      }
    }
  });

  it("resets to unknown on disconnect and clears interval timers on unmount", async () => {
    const testnetAddr = "3WvsT2Gm4EpsM9Pg18PdY6XyhNNMqXDsvJTbbf6ihLvAmSb7u5RN";
    setupFakeWallet({ getChangeAddress: async () => testnetAddr });

    const clearIntervalSpy = spyOn(globalThis, "clearInterval");
    let unmount!: () => void;

    try {
      await act(async () => {
        const rendered = render(
          <ErgoProvider>
            <WalletConnectButton />
            <NetworkGuardProbe recheckMs={60000} />
          </ErgoProvider>
        );
        unmount = rendered.unmount;
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("connect-button"));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId("status").textContent).toBe("wrong-network");

      await act(async () => {
        fireEvent.click(screen.getByTestId("disconnect-button"));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId("status").textContent).toBe("unknown");
      expect(screen.getByTestId("blocked").textContent).toBe("false");

      const callsBeforeUnmount = clearIntervalSpy.mock.calls.length;

      // Reconnect so interval is active at unmount
      await act(async () => {
        fireEvent.click(screen.getByTestId("connect-button"));
      });
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        unmount();
      });

      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    } finally {
      clearIntervalSpy.mockRestore();
    }
  });

  it("performs ZERO get_change_address calls during server renderToString", () => {
    let getChangeAddressCalls = 0;
    setupFakeWallet({
      getChangeAddress: async () => {
        getChangeAddressCalls += 1;
        return "9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8v";
      },
    });

    const html = renderToString(
      <ErgoProvider>
        <NetworkGuardProbe />
      </ErgoProvider>
    );

    expect(html).toContain("unknown");
    expect(html).toContain("false");
    expect(getChangeAddressCalls).toBe(0);
  });
});
