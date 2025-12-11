import { createBaseConfig } from "./base.js";

/**
 * ESLint config for Node.js packages (Lambda, libraries)
 */
export function createNodeConfig() {
  return [
    { ignores: ['dist', 'node_modules', '.serverless'] },
    ...createBaseConfig()
  ];
}

export default createNodeConfig;
