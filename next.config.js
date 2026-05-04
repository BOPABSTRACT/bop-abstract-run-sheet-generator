/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow larger request bodies on API routes (PDFs can be 1-10 MB)
  // Vercel hobby tier caps at ~4.5 MB; pro can go higher
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

module.exports = nextConfig;
