/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/site.html"
      }
    ];
  }
};

export default nextConfig;
