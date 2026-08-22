import { randomUUID } from "node:crypto";
import { getAdminClient } from "./shared.ts";

const client = getAdminClient()!;
const path = `smoke/${randomUUID()}.webp`;
// Minimal valid 1x1 WebP, used only for a private bucket smoke test.
const bytes = Buffer.from(
  "UklGRiIAAABXRUJQVlA4ICAAAABwAQCdASoBAAEALmk0mk0iIiIiIgBoSywA",
  "base64",
);
let uploaded = false;
try {
  const upload = await client.storage
    .from("exercise-media")
    .upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
  if (upload.error) throw upload.error;
  uploaded = true;
  const download = await client.storage.from("exercise-media").download(path);
  if (download.error) throw download.error;
  if (download.data.size !== bytes.length)
    throw new Error("Storage read returned unexpected size");
  process.stdout.write(
    `Storage upload: ok\nAuthenticated read: ok\nCache-Control: 31536000\n`,
  );
} finally {
  if (uploaded) {
    const removed = await client.storage.from("exercise-media").remove([path]);
    if (removed.error) throw removed.error;
    process.stdout.write("Admin delete: ok\nCleanup: ok\n");
  }
}
