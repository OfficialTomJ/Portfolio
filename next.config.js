/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
    return [
      {
        source: "/chronicles",
        destination: "https://crypto-chronicles.beehiiv.com/subscribe",
        permanent: true,
      },
      {
        source: "/discord",
        destination: "https://discord.gg/8tK967YJ6y",
        permanent: true,
      },
      {
        source: "/",
        destination: "/links",
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig;
