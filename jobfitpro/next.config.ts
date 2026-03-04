import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Prevent browsers from MIME-sniffing the Content-Type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Stop the page being embedded in an iframe (clickjacking defense)
  { key: "X-Frame-Options", value: "DENY" },
  // Limit referrer information sent to third-party sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only allow the app to be loaded over HTTPS (1 year, include subdomains)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Restrict browser features (camera, mic, geolocation not needed)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Content Security Policy — allows Supabase, Anthropic calls, inline styles (needed by Tailwind)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Supabase API + auth
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Scripts: self only (no inline scripts — Next.js uses nonces in prod, fine for now)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: unsafe-inline required for Tailwind CSS-in-JS utilities
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs (used by some UI libraries)
      "img-src 'self' data: blob:",
      // Fonts: self
      "font-src 'self'",
      // PDF iframe previews served from Supabase signed URLs
      "frame-src 'self' blob: https://*.supabase.co",
      // No plugins (Flash, etc.)
      "object-src 'none'",
      // Base URI restricted to self
      "base-uri 'self'",
      // Form submissions only to self
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Keep pdf-parse and mammoth as external Node.js modules — they use
  // Node-specific APIs (fs, Buffer) that break when bundled by Turbopack/webpack.
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfkit"],

  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry build-time output noise
  silent: true,
  // Only upload source maps when SENTRY_AUTH_TOKEN is provided
  // (keeps CI and local dev clean without a Sentry account)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
