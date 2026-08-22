import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, SUPABASE_AUTH_COOKIE } from "./env";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE },
  });
}
