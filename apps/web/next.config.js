/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  transpilePackages: [
    '@orbitalmind/shared',
    '@orbitalmind/ui',
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'cesium': 'cesium/Cesium.js',
    };
    config.module.rules.push({
      test: /\.(glsl|vs|fs)$/,
      use: 'raw-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
