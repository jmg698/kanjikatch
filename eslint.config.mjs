import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Next.js 16 removed `next lint`; ESLint is now run via its own CLI against
// this flat config. We keep the same rule surface the project linted with
// before (`next/core-web-vitals`) to avoid churn — eslint-config-next v16
// exports it as a flat-config array directly.
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/**",
    ],
  },
  ...nextCoreWebVitals,
  {
    // eslint-config-next v16 bundles eslint-plugin-react-hooks v7, which adds
    // React-Compiler-era rules that the v5 plugin (used before the Next 16
    // upgrade) did not enforce. They flag real but non-urgent patterns across
    // the review/wild/onboarding components. Demote them to warnings so they
    // stay visible without turning a tooling upgrade into a pre-launch refactor.
    // TODO: burn these down and promote back to "error".
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default config;
