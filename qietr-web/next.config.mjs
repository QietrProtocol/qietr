// Static export for Cloudflare Pages hosting.
// TRD section 1 (web stack): Next.js static export on Cloudflare Pages.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // Static-export friendly image handling.
  images: { unoptimized: true },
  // Trailing slashes keep CF Pages routing predictable for nested routes.
  trailingSlash: true,
};

export default nextConfig;
