import { FlatCompat } from "@eslint/eslintrc";
import { createBaseConfig } from "./base.js";

/**
 * ESLint config for Next.js apps
 * @param {string} dirname - import.meta.dirname from the consuming config
 */
export function createNextConfig(dirname) {
  const compat = new FlatCompat({
    baseDirectory: dirname,
  });

  return [
    { ignores: [".next"] },
    ...compat.extends("next/core-web-vitals"),
    ...createBaseConfig({ tsconfigRootDir: dirname }),
  ];
}

export default createNextConfig;
