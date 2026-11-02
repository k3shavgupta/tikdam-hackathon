import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  turbopack: { root: process.cwd() },
};

export default nextConfig;
