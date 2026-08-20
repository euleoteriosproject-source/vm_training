import { prepareExternalCandidate } from "../../lib/media/prepare.ts";
import { getAdminClient, log, parseArgs } from "./shared.ts";

const args = parseArgs();
const client = getAdminClient()!;
let query = client
  .from("exercise_media")
  .select(
    "id,status,original_file_url,trim_start,trim_end,media_role,poster_timestamp,exercise:exercises!inner(slug)",
  )
  .in("status", ["reviewing", "failed"])
  .eq("ready_for_processing", true)
  .not("media_role", "is", null)
  .order("match_score", { ascending: false });
if (args.exercise) query = query.eq("exercise.slug", args.exercise);
if (args.mediaId) query = query.eq("id", args.mediaId);
const { data, error } = await query;
if (error) throw error;

let processed = 0;
let failed = 0;
for (const candidate of data ?? []) {
  const startedAt = new Date().toISOString();
  const { error: startError } = await client
    .from("exercise_media")
    .update({
      status: "processing",
      processing_started_at: startedAt,
      processing_error: null,
      processing_log: [{ at: startedAt, event: "processing_started" }],
    })
    .eq("id", candidate.id);
  if (startError) {
    failed++;
    log("FAILED", `${candidate.id}: ${startError.message}`);
    continue;
  }
  await client.from("media_review_events").insert({
    media_id: candidate.id,
    action: "processing_started",
    from_status: candidate.status,
    to_status: "processing",
  });
  try {
    const prepared = await prepareExternalCandidate(client, candidate as never);
    const finishedAt = prepared.processed_at;
    const { error: updateError } = await client
      .from("exercise_media")
      .update({
        ...prepared,
        processing_log: [
          { at: startedAt, event: "processing_started" },
          { at: finishedAt, event: "processed" },
        ],
      })
      .eq("id", candidate.id);
    if (updateError) throw updateError;
    await client.from("media_review_events").insert({
      media_id: candidate.id,
      action: "processed",
      from_status: "processing",
      to_status: "processed",
    });
    processed++;
    log("PROCESSED", candidate.id);
  } catch (processingError) {
    const message =
      processingError instanceof Error
        ? processingError.message.slice(0, 2000)
        : String(processingError).slice(0, 2000);
    await client
      .from("exercise_media")
      .update({
        status: "failed",
        processing_error: message,
        processing_log: [
          { at: startedAt, event: "processing_started" },
          { at: new Date().toISOString(), event: "processing_failed", message },
        ],
      })
      .eq("id", candidate.id);
    await client.from("media_review_events").insert({
      media_id: candidate.id,
      action: "processing_failed",
      from_status: "processing",
      to_status: "failed",
      notes: message,
    });
    failed++;
    log("FAILED", `${candidate.id}: ${message}`);
  }
}

process.stdout.write(`Processed: ${processed}\nFailed: ${failed}\n`);
if (failed) process.exitCode = 1;
