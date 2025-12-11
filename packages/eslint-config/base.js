import tseslint from "typescript-eslint";
// @ts-ignore -- no types for this plugin
import drizzle from "eslint-plugin-drizzle";

/**
 * Base ESLint config for all packages
 * @param {Object} options
 * @param {string} options.tsconfigRootDir - Directory containing tsconfig.json
 */
export function createBaseConfig(options = {}) {
  return tseslint.config(
    {
      files: ["**/*.ts", "**/*.tsx"],
      plugins: {
        drizzle,
      },
      extends: [
        ...tseslint.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        ...tseslint.configs.stylisticTypeChecked,
      ],
      rules: {
        "@typescript-eslint/array-type": "off",
        "@typescript-eslint/consistent-type-definitions": "off",
        "@typescript-eslint/consistent-type-imports": [
          "warn",
          { prefer: "type-imports", fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } },
        ],
        "drizzle/enforce-delete-with-where": [
          "error",
          { drizzleObjectName: ["db", "ctx.db"] },
        ],
        "drizzle/enforce-update-with-where": [
          "error",
          { drizzleObjectName: ["db", "ctx.db"] },
        ],
      },
    },
    {
      linterOptions: {
        reportUnusedDisableDirectives: true,
      },
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: options.tsconfigRootDir,
        },
      },
    },
  );
}

export default createBaseConfig;
