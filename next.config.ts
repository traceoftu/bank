import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 호환 설정
  experimental: {
    // Edge runtime 사용
  },
};

export default nextConfig;
