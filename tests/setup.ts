/**
 * Global test setup for Bun test runner
 * This file configures the test environment and provides global utilities
 */

// Mock browser APIs that might not be available in test environment
if (typeof window === 'undefined') {
    global.window = {} as any;
}

// Mock localStorage for tests
class LocalStorageMock {
    private store: Record<string, string> = {};

    clear() {
        this.store = {};
    }

    getItem(key: string) {
        return this.store[key] || null;
    }

    setItem(key: string, value: string) {
        this.store[key] = value.toString();
    }

    removeItem(key: string) {
        delete this.store[key];
    }

    get length() {
        return Object.keys(this.store).length;
    }

    key(index: number) {
        const keys = Object.keys(this.store);
        return keys[index] || null;
    }
}

global.localStorage = new LocalStorageMock() as any;

// Mock console methods to reduce noise in tests (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: () => {},
//   debug: () => {},
//   info: () => {},
//   warn: () => {},
// };

export { };
