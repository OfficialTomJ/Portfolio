/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/links",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
