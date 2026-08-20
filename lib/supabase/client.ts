import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, SUPABASE_AUTH_COOKIE } from "./env";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  const browserUrl =
    typeof window === "undefined"
      ? url
      : `${window.location.origin}/supabase`;
  return createBrowserClient(browserUrl, key, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE },
  });
}
