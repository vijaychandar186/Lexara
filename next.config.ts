import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { 
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
      },
      { 
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
      }
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
      ],
      bodySizeLimit: '16mb',
    }
  }
};

export default nextConfig;