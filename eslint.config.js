import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["dist/**", "node_modules/**", "release/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["scripts/smoke.mjs"],
    languageOptions: {
      globals: { document: "readonly", window: "readonly", Event: "readonly" },
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", Buffer: "readonly" },
    },
  },
);
