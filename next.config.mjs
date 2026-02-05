/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  // In development, serve static assets from the root to avoid 404s on nested routes
  // In production, use relative paths for file:// protocol compatibility
  assetPrefix: process.env.NODE_ENV === 'development' ? '/' : '.',
}

export default nextConfig