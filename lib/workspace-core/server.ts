import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getWorkspaceCoreEnv } from "./config";

export function createWorkspaceCoreServerClient() {
  const { url, secretKey } = getWorkspaceCoreEnv();
  if (!url || !secretKey) {
    throw new Error(
      "Workspace Core env が未設定です（WORKSPACE_CORE_SUPABASE_URL / WORKSPACE_CORE_SUPABASE_SECRET_KEY）。",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
