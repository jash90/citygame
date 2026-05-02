import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3003';

const nextConfig: NextConfig = {
  transpilePackages: ['@citygame/shared'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      // NOTE: Socket.IO is NOT proxied here. Vercel's production rewrites can't
      // forward WebSocket upgrade frames to an external host (they return 308).
      // The browser connects to the WS host directly via NEXT_PUBLIC_WS_URL.
    ];
  },
};

export default nextConfig;
