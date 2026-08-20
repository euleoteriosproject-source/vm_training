export const MEDIA_HOST_ALLOWLIST = new Set([
  "commons.wikimedia.org",
  "upload.wikimedia.org",
]);
export function validateExternalMediaUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL de mídia inválida");
  }
  if (url.protocol !== "https:")
    throw new Error("A mídia externa deve usar HTTPS");
  if (!MEDIA_HOST_ALLOWLIST.has(url.hostname.toLowerCase()))
    throw new Error(`Host não permitido: ${url.hostname}`);
  if (url.username || url.password)
    throw new Error("Credenciais em URL não são permitidas");
  return url;
}
