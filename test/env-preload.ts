/**
 * @file env-preload.ts
 * @description Cleans NEXT_PUBLIC_* environment variables so env.ts initializes cleanly in test runner.
 * @module test
 */
for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    delete process.env[key];
  }
}
