import type { NextConfig } from "next";

const nextConfig: NextConfig = {
        cacheComponents: true,
        allowedDevOrigins: [
                "*.replit.dev",
                "*.replit.app",
                "*.repl.co",
                "127.0.0.1",
                "localhost",
        ],
        images: {
                remotePatterns: [
                        {
                                hostname: "avatar.vercel.sh",
                        },
                        {
                                protocol: "https",
                                hostname: "*.public.blob.vercel-storage.com",
                        },
                ],
        },
};

export default nextConfig;
