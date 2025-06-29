/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: "javascript/auto",
      use: [
        {
          loader: "wasm-loader",
        },
      ],
    });

    return config;
  },
};

module.exports = nextConfig;
