import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".sst/**/*",
      "**/sst-env.d.ts",
      "**/schema.docs.graphql.d.ts",
      "**/routeTree.gen.ts",
      "**/dist/**/*",
      "**/build/**/*",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./packages/*/tsconfig.json"],
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-use-before-define": [
        "error",
        { variables: true, functions: false, classes: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^$",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
