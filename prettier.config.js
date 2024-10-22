/** @type {import('prettier').Config} */
module.exports = {
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "",
    "^types$",
    "^@/core/(.*)$",
    "^@/lib/(.*)$",
    "^@/hooks/(.*)$",
    "^@/components/ui/(.*)$",
    "^@/components/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
};
