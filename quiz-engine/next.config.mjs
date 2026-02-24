/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Monaco editor fix
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
  // Ensure server-only env vars are never bundled into the client
  serverExternalPackages: [],
};
export default nextConfig;
