import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  agentRules: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
