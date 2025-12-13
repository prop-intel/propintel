import { createBaseConfig } from "./base.js";

/**
 * ESLint config for Node.js packages (Lambda, libraries)
 * @param {string} dirname - import.meta.dirname from the consuming config
 */
export function createNodeConfig(dirname) {
  return [
    { ignores: ["dist", "node_modules", ".serverless"] },
    ...createBaseConfig({ tsconfigRootDir: dirname }),
  ];
}

export default createNodeConfig;
