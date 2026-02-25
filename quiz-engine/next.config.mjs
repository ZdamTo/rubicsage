/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker / self-hosted deployments.
  // Produces a minimal .next/standalone bundle + .next/static assets.
  output: "standalone",

  webpack: (config) => {
    // Monaco editor fix
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
  // Ensure server-only env vars are never bundled into the client
  serverExternalPackages: [],
};
export default nextConfig;
