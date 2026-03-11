import { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['gluon-ergo-sdk'],
  experimental: {
    externalDir: true,
  },
  // Disable turbopack to use webpack which has better symlink support
  // turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline'; object-src 'none';",
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Enable symlink resolution
    config.resolve.symlinks = true;
    
    // Enable WebAssembly support for ergo-lib-wasm
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Set target to support async/await for WebAssembly
    config.target = isServer ? 'node16' : ['web', 'es2020'];
    
    return config;
  },
};

export default nextConfig;
