/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: function (config, options) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
      syncWebAssembly: true,
    }
    
    // Exclude .map files
    config.module.rules.push({
      test: /\.map$/,
      use: 'null-loader',
    })
    
    config.module.rules.push({
      test: /\.d\.ts$/,
      use: 'null-loader',
    })

    // Add browser fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    }

    return config
  },
}

export default nextConfig