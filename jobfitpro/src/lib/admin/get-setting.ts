import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Reads a single value from system_settings using the admin (service-role) client.
 * Returns null if the key is not found.
 *
 * Server-only — never import in client components.
 */
export async function getSystemSetting(key: string): Promise<Json | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}
