import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
} from "@/lib/media/ffmpeg";
import { getLicense } from "@/lib/media/licenses";
import { prepareLocalFile } from "@/lib/media/prepare";
import {
  createAdminClient,
  isAdminMaintenanceConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LicenseCode } from "@/lib/media/types";

export const runtime = "nodejs";
const fields = z.object({
  exerciseId: z.string().uuid(),
  sourceName: z.string().min(2).max(120),
  sourceType: z.enum(["self_produced", "licensed_pack"]),
  licenseCode: z.enum(["CUSTOM", "VITAL-FREE-PACK"]),
  mediaRole: z.enum(["PRIMARY_DEMO", "EDUCATIONAL", "ALTERNATIVE_VARIATION"]),
  author: z.string().max(200).optional(),
  attributionText: z.string().max(1000).optional(),
});
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (!isAdminMaintenanceConfigured())
    return NextResponse.json(
      { error: "Fluxo operacional indisponível neste deployment" },
      { status: 503 },
    );
  const form = await request.formData();
  const parsed = fields.safeParse({
    exerciseId: form.get("exerciseId"),
    sourceName: form.get("sourceName"),
    sourceType: form.get("sourceType"),
    licenseCode: form.get("licenseCode"),
    mediaRole: form.get("mediaRole"),
    author: String(form.get("author") ?? "") || undefined,
    attributionText: String(form.get("attributionText") ?? "") || undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  if (!["video/mp4", "video/webm", "image/gif"].includes(file.type))
    return NextResponse.json(
      { error: "Formato não permitido" },
      { status: 415 },
    );
  const max = Number(process.env.MAX_SOURCE_MEDIA_MB ?? 100) * 1024 * 1024;
  if (file.size > max)
    return NextResponse.json(
      { error: "Arquivo excede o limite" },
      { status: 413 },
    );
  const admin = createAdminClient();
  const { data: exercise, error: exerciseError } = await admin
    .from("exercises")
    .select("id,slug")
    .eq("id", parsed.data.exerciseId)
    .single();
  if (exerciseError)
    return NextResponse.json({ error: exerciseError.message }, { status: 404 });
  const license = getLicense(parsed.data.licenseCode as LicenseCode);
  if (license.sourceType !== parsed.data.sourceType)
    return NextResponse.json(
      { error: "Licença incompatível com a origem" },
      { status: 400 },
    );
  if (
    license.attributionRequired &&
    (!parsed.data.author || !parsed.data.attributionText)
  )
    return NextResponse.json(
      { error: "Autor e atribuição são obrigatórios" },
      { status: 400 },
    );
  const workspace = await createMediaWorkspace();
  try {
    const extension =
      file.type === "image/gif"
        ? "gif"
        : file.type === "video/webm"
          ? "webm"
          : "mp4";
    const input = path.join(workspace, `upload.${extension}`);
    await writeFile(input, Buffer.from(await file.arrayBuffer()));
    const prepared = await prepareLocalFile(admin, {
      exerciseSlug: exercise.slug,
      inputPath: input,
      mediaRole: parsed.data.mediaRole,
    });
    const { data, error } = await admin
      .from("exercise_media")
      .insert({
        ...prepared,
        exercise_id: exercise.id,
        angle: "main",
        media_role: parsed.data.mediaRole,
        source_name: parsed.data.sourceName,
        source_type: parsed.data.sourceType,
        source_url: `self-produced://admin/${user.id}`,
        license_code: license.code,
        license_url: license.url,
        author: parsed.data.author ?? parsed.data.sourceName,
        attribution_text:
          parsed.data.attributionText ??
          `${parsed.data.sourceName}. Licença: ${license.name}.`,
        attribution_required: license.attributionRequired,
        candidate_metadata: { originalFilename: file.name },
      })
      .select("id")
      .single();
    if (error) {
      await admin.storage
        .from("exercise-media")
        .remove([prepared.storage_path, prepared.poster_path]);
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha no processamento",
      },
      { status: 422 },
    );
  } finally {
    await cleanupMediaWorkspace(workspace);
  }
}
