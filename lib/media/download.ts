import { validateExternalMediaUrl } from "./url-safety.ts";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function downloadMedia(
  source: string,
  options?: { maxMb?: number; timeoutMs?: number; retries?: number },
) {
  let url = validateExternalMediaUrl(source);
  const maxBytes =
    (options?.maxMb ?? Number(process.env.MAX_SOURCE_MEDIA_MB ?? 100)) *
    1024 *
    1024;
  const retries = options?.retries ?? 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? 30000,
    );
    try {
      for (let redirects = 0; redirects < 4; redirects++) {
        const response = await fetch(url, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": "VMTrainingMediaPipeline/1.1 (license-review)",
          },
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error("Redirect sem destino");
          url = validateExternalMediaUrl(new URL(location, url).toString());
          continue;
        }
        if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
        const type = response.headers.get("content-type")?.split(";")[0] ?? "";
        if (!["video/webm", "video/mp4", "image/gif"].includes(type))
          throw new Error(`MIME não permitido: ${type}`);
        const declared = Number(response.headers.get("content-length") ?? 0);
        if (declared > maxBytes)
          throw new Error("Arquivo excede o limite configurado");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Resposta sem corpo");
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw new Error("Arquivo excede o limite configurado");
          }
          chunks.push(value);
        }
        return {
          buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
          mime: type,
          finalUrl: url.toString(),
          size,
        };
      }
      throw new Error("Muitos redirects");
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Download falhou");
}
