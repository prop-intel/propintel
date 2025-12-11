import type { NextConfig } from "next";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import "./src/env.ts";

const nextConfig: NextConfig = {
  // Enable transpilation for workspace packages
  transpilePackages: [
    "@propintel/database",
    "@propintel/types",
  ],
};

export default nextConfig;
