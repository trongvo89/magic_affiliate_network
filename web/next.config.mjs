/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const dest = process.env.API_URL || 'http://localhost:4000'
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${dest}/:path*`,
      },
    ]
  },
}
export default nextConfig
