/**
 * @file eslint.config.mjs
 * @description Flat ESLint configuration supporting Next.js, TypeScript, and Prettier.
 */
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier";

const eslintConfig = [
  nextPlugin.configs["core-web-vitals"],
  ...tseslint.configs.recommended,
  {
    ignores: ["lib/**", ".next/**", "out/**", "node_modules/**", "*.config.js", "*.config.mjs", "*.config.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-nocheck": false,
        },
      ],
    },
  },
  {
    rules: {
      "prettier/prettier": "off",
    },
  },
];

export default eslintConfig;
