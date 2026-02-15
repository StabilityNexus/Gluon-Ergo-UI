import { describe, expect, test } from "bun:test";
import { cn } from "@/lib/utils/utils";

describe("cn (className utility)", () => {
    test("should merge class names correctly", () => {
        const result = cn("foo", "bar");
        expect(result).toBe("foo bar");
    });

    test("should handle conditional classes", () => {
        const result = cn("foo", false && "bar", "baz");
        expect(result).toBe("foo baz");
    });

    test("should merge Tailwind classes correctly", () => {
        // tailwind-merge should handle conflicting classes
        const result = cn("px-2 py-1", "px-4");
        expect(result).toBe("py-1 px-4");
    });

    test("should handle arrays of classes", () => {
        const result = cn(["foo", "bar"], "baz");
        expect(result).toBe("foo bar baz");
    });

    test("should handle objects with boolean values", () => {
        const result = cn({
            foo: true,
            bar: false,
            baz: true,
        });
        expect(result).toBe("foo baz");
    });

    test("should handle empty input", () => {
        const result = cn();
        expect(result).toBe("");
    });

    test("should handle undefined and null values", () => {
        const result = cn("foo", undefined, null, "bar");
        expect(result).toBe("foo bar");
    });

    test("should handle complex Tailwind class conflicts", () => {
        const result = cn(
            "bg-red-500 text-white",
            "bg-blue-500" // Should override bg-red-500
        );
        expect(result).toBe("text-white bg-blue-500");
    });
});
