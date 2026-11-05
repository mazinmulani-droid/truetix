import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors don't block the production build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
