import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase admin client that bypasses RLS using the service role key.
 *
 * IMPORTANT: Server-only. Never import this in client components or expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. Use for:
 *  - Writing to the `outputs` storage bucket (clients have read-only access)
 *  - Administrative operations that need to bypass RLS
 */
export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
