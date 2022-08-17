/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experiments: {
    asyncWebAssembly: true
  },
}

module.exports = nextConfig
