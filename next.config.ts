import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images: Supabase Storage (uploaded photos) + Airbnb CDN (in case we ever proxy raw)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "a0.muscache.com",
        pathname: "/im/pictures/**",
      },
    ],
  },
  // Don't fail builds on lint warnings; CI/Vercel can lint separately if desired.
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
