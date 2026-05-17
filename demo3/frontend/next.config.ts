import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: (config) => {
    config.resolve.modules.push(path.resolve(__dirname, "node_modules"));
    return config;
  },
};

export default nextConfig;
