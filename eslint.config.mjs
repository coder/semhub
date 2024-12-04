import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".sst/**/*",
      "**/sst-env.d.ts",
      "**/schema.docs.graphql.d.ts",
      "**/routeTree.gen.ts",
      "**/dist/**/*",
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
        project: true,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
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
