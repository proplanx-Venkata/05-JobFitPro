import * as Sentry from "@sentry/nextjs";
import { baseSentryConfig } from "@/lib/ai/sentry-config";

Sentry.init(baseSentryConfig(process.env.NEXT_PUBLIC_SENTRY_DSN));
