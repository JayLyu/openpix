import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // GitHub Pages 部署在 /openpix 子路径；本地 dev 不加 basePath，避免访问 / 时 404
  ...(process.env.NODE_ENV === "production"
    ? { basePath: "/openpix" }
    : {}),
};

export default nextConfig;
