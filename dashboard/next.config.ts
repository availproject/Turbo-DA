import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_IMAGES_URL: process.env.NEXT_PUBLIC_IMAGES_URL,
  },
  images: {
    remotePatterns: [new URL(process.env.NEXT_PUBLIC_IMAGES_URL + "**")],
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
