const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Help center articles are Markdown read from disk at render time; make
  // sure they ship with the serverless functions that render them.
  outputFileTracingIncludes: {
    "/help": ["./src/content/help/**/*.md"],
    "/help/[slug]": ["./src/content/help/**/*.md"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "*.ufs.sh",
        pathname: "/f/**",
      },
    ],
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  silent: !process.env.CI,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Route Sentry events through your Next.js server to avoid ad blockers
  tunnelRoute: "/monitoring",
});
