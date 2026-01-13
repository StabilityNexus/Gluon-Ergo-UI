import { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: function (config: any, options: any) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
    };

    // Exclude .map files
    config.module.rules.push({
      test: /\.map$/,
      use: "null-loader",
    });

    config.module.rules.push({
      test: /\.d\.ts$/,
      use: "null-loader",
    });

    // Add browser fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };

    // Externalize WASM libraries for server-side to avoid bundling issues
    if (options.isServer) {
      config.externals = config.externals || [];
      // Externalize both WASM libraries so they load from node_modules directly
      config.externals.push("ergo-lib-wasm-browser", "ergo-lib-wasm-nodejs");
    }

    return config;
  },
};

export default nextConfig;
