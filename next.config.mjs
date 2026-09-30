const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api-kitchen.grubpacapp.tech/api/v1";

const apiHost = new URL(apiBaseUrl).hostname;

/**
 * Kitchens and menu items come back with absolute S3 URLs, so the image optimizer
 * needs those hosts allow-listed too. Add further hosts via NEXT_PUBLIC_IMAGE_HOSTS
 * (comma separated) rather than editing this file.
 */
const DEFAULT_IMAGE_HOSTS = [apiHost, "grubpac-kitchen.s3.ap-south-1.amazonaws.com"];

const extraImageHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const imageHosts = Array.from(new Set([...DEFAULT_IMAGE_HOSTS, ...extraImageHosts]));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: imageHosts.flatMap((hostname) => [
      { protocol: "https", hostname, pathname: "/**" },
      { protocol: "http", hostname, pathname: "/**" },
    ]),
    // The app is a phone-first shell capped at 768px, so the 2048/3840 candidates
    // that Next offers by default only bloat the srcset - and the 3840 resize of a
    // large S3 upload can exceed the optimizer's upstream timeout.
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
