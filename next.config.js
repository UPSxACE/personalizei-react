/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: require.resolve("./cache-handler.mjs"),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "localhost",
        port: "",
        pathname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
