import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3003';

const nextConfig: NextConfig = {
  transpilePackages: ['@citygame/shared'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
