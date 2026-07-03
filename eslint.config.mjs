import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";


const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma generated output — not hand-authored code
    "src/generated/**",
  ]),
  // Code-quality budget — catches the "large functions / over-engineered /
  // deeply nested" symptoms that plain eslint-config-next does not.
  // Severity is `error` (not `warn`) on purpose: ESLint's bulk-suppressions
  // baseline (`eslint --suppress-all` → eslint-suppressions.json) only records
  // errors, so errors are what let existing debt be grandfathered while any NEW
  // violation still fails. The suppressions file is the readability-debt ledger;
  // refactors run `eslint --prune-suppressions` to shrink it and it can't grow back.
  // Thresholds are the main knob to tune — raise/lower per how strict you want to be.
  // Scoped to hand-authored code; the vendored shadcn primitives in components/ui
  // are intentionally exempt.
  {
    name: "finance-lab/code-quality",
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "max-params": ["error", 5],
      "max-lines-per-function": [
        "error",
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }],
    },
    plugins: { sonarjs },
  },
]);

export default eslintConfig;
