import * as Sentry from "@sentry/nextjs";
import { baseSentryConfig } from "@/lib/ai/sentry-config";

// Server runtime can use the private SENTRY_DSN; fall back to public var
Sentry.init(baseSentryConfig(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN));
