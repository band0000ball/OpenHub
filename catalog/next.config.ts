import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify SSR 互換性問題が発生した場合は output: 'standalone' を有効化する
  // output: 'standalone',
};

export default nextConfig;
