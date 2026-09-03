const backendOrigin = process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1:3001', 'localhost:3001'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
