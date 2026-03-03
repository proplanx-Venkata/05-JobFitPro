import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function logAiUsage(params: {
  userId: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}): void {
  const admin = createSupabaseAdminClient();
  // No await — logging failure must never break the feature
  admin
    .from("ai_usage_logs")
    .insert({
      user_id: params.userId,
      operation: params.operation,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      model: params.model,
    })
    .then();
}
