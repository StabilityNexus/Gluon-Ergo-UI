/**
 * @file SwapTokenCard.test.tsx
 * @description Unit and hydration tests for SwapTokenCard presentational component.
 * @module test
 */

import { describe, it, expect, afterEach } from "bun:test";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { SwapTokenCard } from "@/lib/components/blockchain/swap/SwapTokenCard";

describe("SwapTokenCard", () => {
  afterEach(cleanup);

  it("renders label, symbol, and formats balanceText or displays em dash when undefined", () => {
    const { rerender } = render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
        balanceText="10.5"
      />
    );

    expect(screen.getByText("From")).toBeDefined();
    expect(screen.getByText("ERG")).toBeDefined();
    expect(screen.getByText("Balance: 10.5")).toBeDefined();

    // When balanceText is undefined, displays "—"
    rerender(
      <SwapTokenCard
        label="To"
        symbol="GAU"
        value="0"
        decimals={9}
        balanceText={undefined}
      />
    );

    expect(screen.getByText("To")).toBeDefined();
    expect(screen.getByText("GAU")).toBeDefined();
    expect(screen.getByText("Balance: —")).toBeDefined();
  });

  it("typing '1.2' calls onChange('1.2')", () => {
    let captured = "";
    render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value=""
        decimals={9}
        onChange={(val) => {
          captured = val;
        }}
      />
    );

    const input = screen.getByPlaceholderText("0") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.2" } });

    expect(captured).toBe("1.2");
  });

  it("typing 'abc' does not call onChange", () => {
    let callCount = 0;
    render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="1"
        decimals={9}
        onChange={() => {
          callCount++;
        }}
      />
    );

    const input = screen.getByDisplayValue("1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });

    expect(callCount).toBe(0);
  });

  it("typing with comma ',' converts to '.' and calls onChange", () => {
    let captured = "";
    render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value=""
        decimals={9}
        onChange={(val) => {
          captured = val;
        }}
      />
    );

    const input = screen.getByPlaceholderText("0") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,5" } });

    expect(captured).toBe("1.5");
  });

  it("rejects input with too many decimal places (onChange not called)", () => {
    let callCount = 0;
    render(
      <SwapTokenCard
        label="From"
        symbol="USD"
        value="1.2"
        decimals={2} // Max 2 decimal digits
        onChange={() => {
          callCount++;
        }}
      />
    );

    const input = screen.getByDisplayValue("1.2") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.234" } });

    expect(callCount).toBe(0);
  });

  it("renders MAX button only when onMax is provided and calls onMax on click", () => {
    let maxClicked = false;
    const { rerender } = render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
      />
    );

    expect(screen.queryByRole("button", { name: "MAX" })).toBeNull();

    rerender(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
        onMax={() => {
          maxClicked = true;
        }}
      />
    );

    const maxBtn = screen.getByRole("button", { name: "MAX" });
    expect(maxBtn).toBeDefined();

    fireEvent.click(maxBtn);
    expect(maxClicked).toBe(true);
  });

  it("disabled prop disables both input and MAX button", () => {
    render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
        onMax={() => {}}
        disabled={true}
      />
    );

    const input = screen.getByDisplayValue("0") as HTMLInputElement;
    const button = screen.getByRole("button", { name: "MAX" }) as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  it("announces error text using role='alert'", () => {
    const { rerender } = render(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
      />
    );

    expect(screen.queryByRole("alert")).toBeNull();

    rerender(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="0"
        decimals={9}
        error="Insufficient ERG balance"
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Insufficient ERG balance");
  });

  it("hydrates without any recoverable errors or mismatch warnings", async () => {
    const html = renderToString(
      <SwapTokenCard
        label="From"
        symbol="ERG"
        value="1.5"
        decimals={9}
        balanceText="20"
        error="Test error"
        onMax={() => {}}
      />
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = html;

    const recoverableErrors: Error[] = [];
    const consoleErrors: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
      originalConsoleError(...args);
    };

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <SwapTokenCard
            label="From"
            symbol="ERG"
            value="1.5"
            decimals={9}
            balanceText="20"
            error="Test error"
            onMax={() => {}}
          />,
          {
            onRecoverableError(error) {
              recoverableErrors.push(error as Error);
            },
          }
        );
      });

      expect(recoverableErrors).toHaveLength(0);
      const mismatchErrors = consoleErrors.filter(
        (msg) =>
          msg.toLowerCase().includes("hydrat") || msg.toLowerCase().includes("did not match")
      );
      expect(mismatchErrors).toHaveLength(0);
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
      console.error = originalConsoleError;
    }
  });
});

