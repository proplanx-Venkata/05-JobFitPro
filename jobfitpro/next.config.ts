import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdf-parse and mammoth as external Node.js modules — they use
  // Node-specific APIs (fs, Buffer) that break when bundled by Turbopack/webpack.
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfkit"],
};

export default nextConfig;
