/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || "ws://localhost:8000/ws/anomalies",
  },
};

// Warn at build time if deploying without production URLs set
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_API_URL) console.warn("⚠  NEXT_PUBLIC_API_URL not set — falling back to localhost");
  if (!process.env.NEXT_PUBLIC_WS_URL)  console.warn("⚠  NEXT_PUBLIC_WS_URL not set — falling back to localhost");
}

module.exports = nextConfig;
