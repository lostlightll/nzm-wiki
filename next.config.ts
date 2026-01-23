import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/nzm-wiki",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
