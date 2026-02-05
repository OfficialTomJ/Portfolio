/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
    return [
      {
        source: "/chronicles",
        destination: "https://cryptochroniclesweekly.substack.com/",
        permanent: true,
      },
      {
        source: "/substack",
        destination: "https://cryptochroniclesweekly.substack.com/",
        permanent: true,
      },
      {
        source: "/discord",
        destination: "https://discord.gg/8tK967YJ6y",
        permanent: true,
      },
      {
        source: "/",
        destination: "/portfolio",
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig;
