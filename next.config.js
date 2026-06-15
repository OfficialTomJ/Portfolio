/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        root: __dirname,
    },
    images: {
        qualities: [75, 100],
        remotePatterns: [
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
            { protocol: "https", hostname: "img.youtube.com" },
        ],
    },
    async redirects() {
    const redirects = [
      {
        source: "/chronicles",
        destination: "https://thomasjohnston.substack.com/",
        permanent: true,
      },
      {
        source: "/substack",
        destination: "https://thomasjohnston.substack.com/",
        permanent: true,
      },
      {
        source: "/discord",
        destination: "https://discord.gg/8tK967YJ6y",
        permanent: true,
      },
    ];

    // Apex/www only — do NOT redirect the mentor subdomain's root.
    // In local dev with DEV_AS_MENTOR=1, plain localhost serves the mentor app,
    // so skip this redirect entirely.
    if (process.env.DEV_AS_MENTOR !== "1") {
      redirects.push({
        source: "/",
        missing: [{ type: "host", value: "mentor\\..*" }],
        destination: "/portfolio",
        permanent: true,
      });
    }

    return redirects;
  },
}

module.exports = nextConfig;
