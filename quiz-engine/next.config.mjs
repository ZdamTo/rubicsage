/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Monaco editor fix
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};
export default nextConfig;
