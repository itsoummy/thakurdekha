import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql", "sharp"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
