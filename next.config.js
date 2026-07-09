/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  basePath: process.env.NEXT_BASE_PATH || "",
  trailingSlash: true,
};

module.exports = nextConfig;