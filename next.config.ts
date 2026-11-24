import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "explainers.assets.alphaxiv.org" },
      { protocol: "https", hostname: "thumbnails.assets.alphaxiv.org" },
      { protocol: "https", hostname: "blog-media.assets.alphaxiv.org" },
    ],
  },
};

export default nextConfig;
