export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseEnv() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicHost = publicUrl ? new URL(publicUrl).hostname : "";
  const publicIsLocal = ["localhost", "127.0.0.1", "::1"].includes(publicHost);
  const url =
    typeof window === "undefined" &&
    process.env.SUPABASE_INTERNAL_URL &&
    !publicIsLocal
      ? process.env.SUPABASE_INTERNAL_URL
      : publicUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  return { url, key };
}

export const SUPABASE_AUTH_COOKIE = "vm-training-auth";
