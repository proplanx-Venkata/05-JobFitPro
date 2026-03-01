import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "./database";

/** Generic API response envelope used by all route handlers. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Auth request/response shapes
// ---------------------------------------------------------------------------

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
}

export interface ProfileResponse {
  user: User;
  profile: Database["public"]["Tables"]["profiles"]["Row"];
}
