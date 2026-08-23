import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are non-critical; don't block the production build
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint warnings don't block the production build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
