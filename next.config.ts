import type { NextConfig } from "next";

// Pull the project-specific Supabase host from the public URL so we never
// proxy arbitrary *.supabase.co hosts through Next.js Image Optimization.
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  try {
    return new URL(url).hostname;
  } catch {
    return "supabase.co";
  }
}

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost(),
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "a0.muscache.com",
        pathname: "/im/pictures/**",
      },
    ],
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
