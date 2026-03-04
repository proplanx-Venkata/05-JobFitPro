/**
 * Shared Sentry init options used by client, server, and edge configs.
 * Each runtime file passes the appropriate DSN env var.
 */
export function baseSentryConfig(dsn: string | undefined) {
  return {
    dsn,
    // Only capture errors in production — no noise in dev or CI
    enabled: process.env.NODE_ENV === "production",
    // Sample 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Never send PII (user IP, identifiers) by default
    sendDefaultPii: false,
  };
}
